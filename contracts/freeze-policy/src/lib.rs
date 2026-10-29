#![no_std]
use soroban_sdk::{
    auth::Context, contract, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, vec, Address, Env, IntoVal, Symbol, Val, Vec,
};
use stellar_accounts::{
    policies::Policy,
    smart_account::{ContextRule, ContextRuleType, Signer},
};

#[contracttype]
#[derive(Clone)]
enum Key {
    Frozen(Address),
}
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    Frozen = 1,
    InvalidRule = 2,
    MissingSigner = 3,
}
#[contractevent]
pub struct FreezeChanged {
    #[topic]
    pub account: Address,
    pub frozen: bool,
}
#[contract]
pub struct FreezePolicy;
#[contractimpl]
impl FreezePolicy {
    /// Missing or expired state fails closed. No bank/admin/upgrade credential exists.
    pub fn frozen(e: &Env, account: Address) -> bool {
        e.storage()
            .persistent()
            .get(&Key::Frozen(account))
            .unwrap_or(true)
    }
    /// Invoke through account.execute(policy, "set_frozen", [account, value]).
    /// Direct invocation during __check_auth would cause a forbidden reentrant call.
    pub fn set_frozen(e: &Env, account: Address, frozen: bool) {
        account.require_auth();
        let key = Key::Frozen(account.clone());
        e.storage().persistent().set(&key, &frozen);
        e.storage().persistent().extend_ttl(&key, 17280, 518400);
        FreezeChanged { account, frozen }.publish(e);
    }
}
fn valid_rule(e: &Env, rule: &ContextRule) {
    if rule.context_type != ContextRuleType::Default
        || rule.signers.len() != 1
        || rule.valid_until.is_some()
    {
        panic_with_error!(e, Error::InvalidRule);
    }
}
#[contractimpl]
impl Policy for FreezePolicy {
    type AccountParams = ();
    fn install(e: &Env, _params: (), rule: ContextRule, account: Address) {
        account.require_auth();
        valid_rule(e, &rule);
        let key = Key::Frozen(account);
        // Installing a backup policy must not clear an existing freeze.
        if !e.storage().persistent().has(&key) {
            e.storage().persistent().set(&key, &false);
        }
        e.storage().persistent().extend_ttl(&key, 17280, 518400);
    }
    fn uninstall(_e: &Env, _rule: ContextRule, account: Address) {
        account.require_auth();
    }
    fn enforce(
        e: &Env,
        context: Context,
        signers: Vec<Signer>,
        rule: ContextRule,
        account: Address,
    ) {
        account.require_auth();
        valid_rule(e, &rule);
        // OZ delegates signer threshold checks to policies. Preserve the single-card requirement.
        if signers.len() != 1 || signers.get(0) != rule.signers.get(0) {
            panic_with_error!(e, Error::MissingSigner);
        }
        if !Self::frozen(e, account.clone()) {
            return;
        }
        if let Context::Contract(c) = context {
            let target_args: Vec<Val> = vec![e, account.clone().into_val(e), false.into_val(e)];
            let expected: Vec<Val> = vec![
                e,
                e.current_contract_address().into_val(e),
                Symbol::new(e, "set_frozen").into_val(e),
                target_args.into_val(e),
            ];
            if c.contract == account && c.fn_name == Symbol::new(e, "execute") && c.args == expected
            {
                return;
            }
        }
        panic_with_error!(e, Error::Frozen);
    }
}
#[cfg(test)]
mod test;
