//! End-to-end host authorization using XDR emitted by the phone's TypeScript codec.
//! The token is a local test contract; no physical card or network state is changed.
#![cfg(test)]
extern crate std;

use super::P256Verifier;
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl,
    crypto::Hash,
    testutils::Ledger,
    vec,
    xdr::{Limits, ReadXdr, SorobanAuthorizationEntry},
    Address, Bytes, Env, IntoVal, Map, String, Symbol, Val, Vec,
};
use stellar_accounts::smart_account::{
    add_context_rule, do_check_auth, AuthPayload, ContextRule, ContextRuleType, Signer,
    SmartAccountError,
};

#[contract]
struct CardAccount;
#[contractimpl]
impl CustomAccountInterface for CardAccount {
    type Error = SmartAccountError;
    type Signature = AuthPayload;
    fn __check_auth(
        e: Env,
        payload: Hash<32>,
        signature: AuthPayload,
        contexts: Vec<Context>,
    ) -> Result<(), Self::Error> {
        do_check_auth(&e, &payload, &signature, &contexts)
    }
}

#[contractimpl]
impl CardAccount {
    pub fn execute(e: Env, target: Address, target_fn: Symbol, target_args: Vec<Val>) {
        e.current_contract_address().require_auth();
        e.invoke_contract::<Val>(&target, &target_fn, target_args);
    }
    pub fn add_context_rule(
        e: Env,
        context_type: ContextRuleType,
        name: String,
        valid_until: Option<u32>,
        signers: Vec<Signer>,
        policies: Map<Address, Val>,
    ) -> ContextRule {
        e.current_contract_address().require_auth();
        add_context_rule(&e, &context_type, &name, valid_until, &signers, &policies)
    }
}

#[contract]
struct TestToken;
#[contractimpl]
impl TestToken {
    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0);
        let before: i128 = e.storage().persistent().get(&from).unwrap_or(0);
        assert!(before >= amount);
        let received: i128 = e.storage().persistent().get(&to).unwrap_or(0);
        e.storage().persistent().set(&from, &(before - amount));
        e.storage().persistent().set(&to, &(received + amount));
    }
    pub fn balance(e: Env, owner: Address) -> i128 {
        e.storage().persistent().get(&owner).unwrap_or(0)
    }
}

struct Fixture {
    e: Env,
    account: Address,
    recipient: Address,
    token: Address,
    entry: SorobanAuthorizationEntry,
}
fn setup(v2: bool) -> Fixture {
    let e = Env::default();
    let network = e
        .crypto()
        .sha256(&Bytes::from_slice(
            &e,
            b"Public Global Stellar Network ; September 2015",
        ))
        .to_array();
    e.ledger().with_mut(|ledger| {
        ledger.sequence_number = 1000;
        ledger.network_id = network;
        ledger.max_entry_ttl = 4096;
    });
    let account = Address::from_str(
        &e,
        "CCEXMACZOTJWBOSJFTSUEDVY6VN3CWEVX3GBPOLMVTFLC3TVWL7H7RHR",
    );
    let verifier = Address::from_str(
        &e,
        "CA5ZJMYHPBW6ZSA5OYAJD3L54MHAN5PUKY5FVT7DXZIZ42YGTSDNRSQF",
    );
    let token = Address::from_str(
        &e,
        "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    );
    let recipient = Address::from_str(
        &e,
        "GAAH4OT36RRCCAGKARGPN2HLHT2NOBVFHO4GUHA6CF7UKQ4MMV24WQ4N",
    );
    e.register_at(&account, CardAccount, ());
    e.register_at(&verifier, P256Verifier, ());
    e.register_at(&token, TestToken, ());
    let secret = p256::SecretKey::from_slice(&[7u8; 32]).unwrap();
    let signing_key = p256::ecdsa::SigningKey::from(&secret);
    let public_key = signing_key.verifying_key().to_encoded_point(false);
    let signer = Signer::External(verifier, Bytes::from_slice(&e, public_key.as_bytes()));
    e.as_contract(&account, || {
        let rule = add_context_rule(
            &e,
            &ContextRuleType::Default,
            &String::from_str(&e, "card"),
            None,
            &vec![&e, signer],
            &Map::new(&e),
        );
        assert_eq!(rule.id, 0);
    });
    e.as_contract(&token, || {
        e.storage().persistent().set(&account, &50_000_000i128)
    });
    let encoded = if v2 {
        include_str!("../fixtures/transfer-v2.xdr")
    } else {
        include_str!("../fixtures/transfer-v1.xdr")
    };
    let entry = SorobanAuthorizationEntry::from_xdr_base64(encoded.trim(), Limits::none()).unwrap();
    Fixture {
        e,
        account,
        recipient,
        token,
        entry,
    }
}

#[test]
fn phone_xdr_authorizes_transfer_and_cannot_replay() {
    for v2 in [false, true] {
        let f = setup(v2);
        let token = TestTokenClient::new(&f.e, &f.token);
        f.e.set_auths(&[f.entry.clone()]);
        token.transfer(&f.account, &f.recipient, &12_500_000);
        assert_eq!(token.balance(&f.account), 37_500_000);
        assert_eq!(token.balance(&f.recipient), 12_500_000);
        f.e.set_auths(&[f.entry]);
        assert!(token
            .try_transfer(&f.account, &f.recipient, &12_500_000)
            .is_err());
        assert_eq!(token.balance(&f.recipient), 12_500_000);
    }
}

#[test]
fn phone_xdr_rejects_changed_amount_recipient_and_expiry() {
    let f = setup(false);
    let token = TestTokenClient::new(&f.e, &f.token);
    f.e.set_auths(&[f.entry.clone()]);
    assert!(token
        .try_transfer(&f.account, &f.recipient, &12_500_001)
        .is_err());
    f.e.set_auths(&[f.entry.clone()]);
    assert!(token
        .try_transfer(&f.account, &f.token, &12_500_000)
        .is_err());
    f.e.ledger()
        .with_mut(|ledger| ledger.sequence_number = 1121);
    f.e.set_auths(&[f.entry]);
    assert!(token
        .try_transfer(&f.account, &f.recipient, &12_500_000)
        .is_err());
    assert_eq!(token.balance(&f.account), 50_000_000);
}

#[test]
fn backup_approval_adds_independent_authority_and_rejects_replay() {
    let f = setup(false);
    let secret = p256::SecretKey::from_slice(&[8u8; 32]).unwrap();
    let signing_key = p256::ecdsa::SigningKey::from(&secret);
    let key = signing_key.verifying_key().to_encoded_point(false);
    let signer = Signer::External(
        Address::from_str(
            &f.e,
            "CA5ZJMYHPBW6ZSA5OYAJD3L54MHAN5PUKY5FVT7DXZIZ42YGTSDNRSQF",
        ),
        Bytes::from_slice(&f.e, key.as_bytes()),
    );
    let client = CardAccountClient::new(&f.e, &f.account);
    let add = || {
        client.try_add_context_rule(
            &ContextRuleType::Default,
            &String::from_str(&f.e, "Backup card"),
            &None,
            &vec![&f.e, signer.clone()],
            &Map::new(&f.e),
        )
    };
    assert!(add().is_err());
    let entry = SorobanAuthorizationEntry::from_xdr_base64(
        include_str!("../fixtures/backup-add.xdr").trim(),
        Limits::none(),
    )
    .unwrap();
    f.e.set_auths(&[entry.clone()]);
    assert_eq!(add().unwrap().unwrap().id, 1);
    f.e.set_auths(&[entry]);
    assert!(add().is_err());
    let token = TestTokenClient::new(&f.e, &f.token);
    f.e.set_auths(&[f.entry]);
    token.transfer(&f.account, &f.recipient, &12_500_000);
    let backup = SorobanAuthorizationEntry::from_xdr_base64(
        include_str!("../fixtures/backup-transfer.xdr").trim(),
        Limits::none(),
    )
    .unwrap();
    f.e.set_auths(&[backup.clone()]);
    token.transfer(&f.account, &f.recipient, &12_500_000);
    assert_eq!(token.balance(&f.account), 25_000_000);
    f.e.set_auths(&[backup]);
    assert!(token
        .try_transfer(&f.account, &f.recipient, &12_500_000)
        .is_err());
}

#[test]
fn card_freezes_and_backup_unfreezes_through_real_openzeppelin_auth() {
    use vaultpass_freeze_policy::{FreezePolicy, FreezePolicyClient};
    let f = setup(false);
    let policy = Address::from_str(
        &f.e,
        "CAPTKW6GZ7USCDVQMDN6IX3X3AV5WDSJWXSXEXA2QVHVDOCBVHY5EULU",
    );
    f.e.register_at(&policy, FreezePolicy, ());
    let secret = p256::SecretKey::from_slice(&[8u8; 32]).unwrap();
    let key = p256::ecdsa::SigningKey::from(&secret)
        .verifying_key()
        .to_encoded_point(false);
    let backup = Signer::External(
        Address::from_str(
            &f.e,
            "CA5ZJMYHPBW6ZSA5OYAJD3L54MHAN5PUKY5FVT7DXZIZ42YGTSDNRSQF",
        ),
        Bytes::from_slice(&f.e, key.as_bytes()),
    );
    // Arrange two independent authorized cards, both protected, using the production OZ storage functions.
    f.e.as_contract(&f.account, || {
        let mut policies = Map::new(&f.e);
        policies.set(policy.clone(), ().into_val(&f.e));
        add_context_rule(
            &f.e,
            &ContextRuleType::Default,
            &String::from_str(&f.e, "Backup"),
            None,
            &vec![&f.e, backup],
            &policies,
        );
        stellar_accounts::smart_account::add_policy(&f.e, 0, &policy, ().into_val(&f.e));
    });
    let client = CardAccountClient::new(&f.e, &f.account);
    let token = TestTokenClient::new(&f.e, &f.token);
    let freeze = SorobanAuthorizationEntry::from_xdr_base64(
        include_str!("../fixtures/freeze.xdr").trim(),
        Limits::none(),
    )
    .unwrap();
    f.e.set_auths(&[freeze.clone()]);
    client.execute(
        &policy,
        &Symbol::new(&f.e, "set_frozen"),
        &vec![&f.e, f.account.clone().into_val(&f.e), true.into_val(&f.e)],
    );
    assert!(FreezePolicyClient::new(&f.e, &policy).frozen(&f.account));
    // Even an already prepared, otherwise valid payment must now fail.
    f.e.set_auths(&[f.entry.clone()]);
    assert!(token
        .try_transfer(&f.account, &f.recipient, &12_500_000)
        .is_err());
    let backup_payment = SorobanAuthorizationEntry::from_xdr_base64(
        include_str!("../fixtures/backup-transfer.xdr").trim(),
        Limits::none(),
    )
    .unwrap();
    f.e.set_auths(&[backup_payment.clone()]);
    assert!(token
        .try_transfer(&f.account, &f.recipient, &12_500_000)
        .is_err());
    let unfreeze = SorobanAuthorizationEntry::from_xdr_base64(
        include_str!("../fixtures/unfreeze.xdr").trim(),
        Limits::none(),
    )
    .unwrap();
    f.e.set_auths(&[unfreeze.clone()]);
    client.execute(
        &policy,
        &Symbol::new(&f.e, "set_frozen"),
        &vec![&f.e, f.account.clone().into_val(&f.e), false.into_val(&f.e)],
    );
    assert!(!FreezePolicyClient::new(&f.e, &policy).frozen(&f.account));
    f.e.set_auths(&[unfreeze]);
    assert!(client
        .try_execute(
            &policy,
            &Symbol::new(&f.e, "set_frozen"),
            &vec![&f.e, f.account.clone().into_val(&f.e), false.into_val(&f.e)]
        )
        .is_err());
    f.e.set_auths(&[backup_payment]);
    token.transfer(&f.account, &f.recipient, &12_500_000);
}
