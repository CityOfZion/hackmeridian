extern crate std;
use super::*;
use soroban_sdk::{auth::ContractContext, testutils::Address as _, Bytes, Map, String};
fn fixture() -> (Env, Address, Address, ContextRule, Vec<Signer>) {
    let e = Env::default();
    e.mock_all_auths();
    let account = Address::generate(&e);
    let policy = e.register(FreezePolicy, ());
    let signer = Signer::External(Address::generate(&e), Bytes::from_slice(&e, &[4; 65]));
    let signers = vec![&e, signer];
    let rule = ContextRule {
        id: 0,
        signer_ids: vec![&e, 0u32],
        policy_ids: vec![&e, 0u32],
        context_type: ContextRuleType::Default,
        name: String::from_str(&e, "Card"),
        valid_until: None,
        signers: signers.clone(),
        policies: vec![&e, policy.clone()],
    };
    FreezePolicyClient::new(&e, &policy).install(&(), &rule, &account);
    (e, account, policy, rule, signers)
}
fn ctx(e: &Env, target: &Address, name: &str, args: Vec<Val>) -> Context {
    Context::Contract(ContractContext {
        contract: target.clone(),
        fn_name: Symbol::new(e, name),
        args,
    })
}
#[test]
fn freeze_blocks_spending_but_allows_only_exact_unfreeze() {
    let (e, account, policy, rule, signers) = fixture();
    let c = FreezePolicyClient::new(&e, &policy);
    let transfer = ctx(&e, &Address::generate(&e), "transfer", Vec::new(&e));
    c.enforce(&transfer, &signers, &rule, &account);
    c.set_frozen(&account, &true);
    assert!(c.try_enforce(&transfer, &signers, &rule, &account).is_err());
    let args: Vec<Val> = vec![&e, account.clone().into_val(&e), false.into_val(&e)];
    let unfreeze = ctx(
        &e,
        &account,
        "execute",
        vec![
            &e,
            policy.clone().into_val(&e),
            Symbol::new(&e, "set_frozen").into_val(&e),
            args.into_val(&e),
        ],
    );
    c.enforce(&unfreeze, &signers, &rule, &account);
    let attacker = ctx(
        &e,
        &account,
        "execute",
        vec![
            &e,
            Address::generate(&e).into_val(&e),
            Symbol::new(&e, "set_frozen").into_val(&e),
            Vec::<Val>::new(&e).into_val(&e),
        ],
    );
    assert!(c.try_enforce(&attacker, &signers, &rule, &account).is_err());
    assert!(c
        .try_enforce(&unfreeze, &Vec::new(&e), &rule, &account)
        .is_err());
    c.install(&(), &rule, &account);
    assert!(c.frozen(&account));
    c.set_frozen(&account, &false);
    c.enforce(&transfer, &signers, &rule, &account);
}
#[test]
fn cannot_change_another_accounts_state_without_authority() {
    let e = Env::default();
    let policy = e.register(FreezePolicy, ());
    let account = Address::generate(&e);
    let c = FreezePolicyClient::new(&e, &policy);
    assert!(c.frozen(&account));
    assert!(c.try_set_frozen(&account, &false).is_err());
    let _ = Map::<Address, Val>::new(&e);
}
