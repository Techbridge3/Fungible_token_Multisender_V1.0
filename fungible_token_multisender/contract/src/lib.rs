use std::collections::HashMap;
use std::convert::{TryFrom, TryInto};

#[allow(unused_imports)]
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::{env, ext_contract, near_bindgen, AccountId, Promise, PromiseResult, Gas, Balance, PromiseOrValue};
use near_sdk::serde::{Deserialize, Serialize};

#[allow(dead_code)]
//synthetic REF token contract
const TOKEN_CONTRACT:&str = "fungible_token.testnet";
const MULTISENDER_CONTRACT:&str = "dev-1652445607364-51522207500129";
//gas constants
pub const CALLBACK_GAS: Gas = Gas(5_000_000_000_000);
pub const PROMISE_CALL: Gas = Gas(5_000_000_000_000);
pub const GAS_FOR_FT_TRANSFER: u128 = 10_000_000_000_000;
pub const NO_DEPOSIT: u128 = 0;


// define the methods we'll use on the other contract
#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_balance_of(&mut self, account_id: AccountId) -> U128;
    fn storage_deposit(&self, account_id: AccountId);
    fn ft_transfer(&mut self, receiver_id: String, amount: String);
    fn ft_transfer_call(&mut self, receiver_id: String, amount: String, msg: String);
}

// define methods we'll use as callbacks on our contract
#[ext_contract(ext_self)]
pub trait MyContract {
    fn on_ft_balance_of(&self, account_id: AccountId) -> String;
    //fn on_ft_transfer_deposit(&mut self, account_id: AccountId, amount: U128);
    fn on_transfer_from_balance(&mut self, account_id: AccountId, amount: Balance, recipient: AccountId);
}

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct MultisenderFt {
    user_balances : HashMap<AccountId, Balance>,
    deposits: HashMap<AccountId, u128>
}
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Operation {
    account_id: AccountId,
    amount: U128,
}

#[near_bindgen]
impl MultisenderFt {
    #[payable]
    //deposit to multisender
    pub fn deposit(&mut self, account_id: AccountId, deposit_amount: U128) -> U128 {
        //get user balance
        let balance = self.get_user_balance(account_id.clone()).0;
        assert!(
            balance > deposit_amount.0 + GAS_FOR_FT_TRANSFER,
            "You need {} more yocto_FT for deposit to Multisender", deposit_amount.0 + GAS_FOR_FT_TRANSFER - balance
        );

        let attached_tokens: u128 = deposit_amount.0; 
        let previous_balance: u128 = self.get_deposit(account_id.clone()).into();

        // update info about user deposit in MULTISENDER

        self.deposits.insert(account_id.clone(), previous_balance + attached_tokens);
        self.get_deposit(account_id)
    }

    //withdraw all from multisender
    #[payable]
    pub fn withdraw_all(&mut self, account_id: AccountId) {
        //get user balance
        let deposit: u128 = self.get_deposit(account_id.clone()).into();
        assert!(
            deposit > GAS_FOR_FT_TRANSFER,
            "Nothing to withdraw!"
        );
        self.ft_on_transfer(
            account_id.clone(),
            deposit.into()
        );
        
        self.deposits.insert(account_id, 0);
    }
    
    //**utils** get deposited to multisender amount
    pub fn get_deposit(&self, account_id: AccountId) -> U128 {
        match self.deposits.get(&account_id) {
            Some(deposit) => {
                U128::from(*deposit)
            }
            None => {
                0.into()
            }
        }
    }
    //**call** get FT balance cross-contract call
    pub fn get_balance(&mut self, account_id: AccountId) -> Promise {

        ext_ft::ft_balance_of(
            account_id.clone(),
            TOKEN_CONTRACT.parse().unwrap(), // contract account id
            NO_DEPOSIT, // yocto FT to attach
            CALLBACK_GAS // gas to attach
        )
        .then(ext_self::on_ft_balance_of(
            account_id,
            env::current_account_id(), // this contract's account id
            NO_DEPOSIT, // yocto FT to attach to the callback
            CALLBACK_GAS // gas to attach to the callback
        ))
    }
    //**utils** get FT balance of user after  cross-contract call
    pub fn get_user_balance(&self, account_id: AccountId) -> U128 {
        //cross-contract call and adding info about balance into contract

        match self.user_balances.get(&account_id) {
            Some(balance) => {
                U128::from(*balance)
            }
            None => {
                0.into()
            }
        }
    }
    //**callback** get FT balance cross-contract callback
    pub fn on_ft_balance_of(&mut self, account_id: AccountId) -> U128 {
        assert_eq!(
            env::promise_results_count(),
            1,
            "This is a callback method"
        );
        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => panic!("failed promise!"),
            PromiseResult::Successful(result) => {
                let balance = near_sdk::serde_json::from_slice::<U128>(&result).unwrap();
                self.user_balances.insert(account_id, balance.0);
                balance
            }
        }
    }
    #[payable]
    //transfer cross-contract call
    //near call fungible_token.testnet ft_transfer_call '{
        //"receiver_id":"'participant_2.testnet'",
        //"amount": "101000000200001100",
        //"msg":"hi"
    //}
    //' --accountId oilbird.testnet --amount 1Yocto --gas 300000000000000
    pub fn ft_on_transfer(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        // msg: String,
    ) -> Promise {

        let sender_id = env::predecessor_account_id();
        let sender_deposit = *self.deposits
            .get(&sender_id)
            .expect(&(format!("No sender with id {}",&sender_id)));

        assert!(
            sender_deposit > amount.0 - GAS_FOR_FT_TRANSFER,
             "You need more funds to make a transfer action"
            );
        
        ext_ft::storage_deposit(
            receiver_id.clone(),
            AccountId::try_from(TOKEN_CONTRACT.to_string()).unwrap(),
            1250000000000000000000,
            CALLBACK_GAS
        );

        ext_ft::ft_transfer(
            receiver_id.to_string(),
            amount.0.to_string(),
            AccountId::try_from(TOKEN_CONTRACT.to_string()).unwrap(),
            1u128.into(),
            CALLBACK_GAS
        )
        //return PromiseOrValue::Value(U128(0))
    }

    //multisender transfer from deposit
    #[payable]
    pub fn multisend_from_balance(&mut self, accounts: Vec<Operation>) {
        let account_id = env::predecessor_account_id();

        assert!(self.deposits.contains_key(&account_id), "Unknown user");

        let mut tokens: Balance = *self.deposits.get(&account_id).unwrap();
        let mut total: Balance = 0;

        for account in &accounts {
            assert!(
                env::is_valid_account_id(account.account_id.as_bytes()),
                "Account @{} is invalid",
                account.account_id
            );

            let amount: Balance = account.amount.into();
            total += amount;
        }

        assert!(
            total <= tokens,
            "Not enough deposited tokens to run multisender (Supplied: {}. Demand: {})",
            tokens,
            total
        );

        let mut logs: String = "".to_string();
        let direct_logs: bool = accounts.len() < 100;

        for account in accounts {
            let amount_u128: u128 = account.amount.into();

            if direct_logs {
                env::log_str(format!("Sending {} yFT (~{} FT) to account @{}", amount_u128, yocto_ft(amount_u128), account.account_id).as_str());
            } else {
                let log = format!("Sending {} yFT (~{} FT) to account @{}\n", amount_u128, yocto_ft(amount_u128), account.account_id);
                logs.push_str(&log);
            }

            tokens -= amount_u128;
            self.deposits.insert(account_id.clone(), tokens);

            //transfer
            self.ft_on_transfer(
                account.account_id.clone(),
                account.amount,
            )
            .then(
                ext_self::on_transfer_from_balance(
                    account.account_id.clone(),
                    account.amount.into(),
                    account.account_id,
                    env::current_account_id(),
                    NO_DEPOSIT,
                    Gas(GAS_FOR_FT_TRANSFER.try_into().unwrap())
                )
            );
            
        }

        if !direct_logs {
            env::log_str(format!("Done!\n{}", logs).as_str());
        }
    }

    pub fn multisend_from_balance_unsafe(&mut self, accounts: Vec<Operation>) {
        let account_id = env::predecessor_account_id();

        assert!(self.deposits.contains_key(&account_id), "Unknown user");

        let tokens: Balance = *self.deposits.get(&account_id).unwrap();
        let mut total: Balance = 0;
        for account in &accounts {
            assert!(
                env::is_valid_account_id(account.account_id.as_bytes()),
                "Account @{} is invalid",
                account.account_id
            );

            let amount: Balance = account.amount.into();
            total += amount;
        }

        assert!(
            total <= tokens,
            "Not enough deposited tokens to run multisender (Supplied: {}. Demand: {})",
            tokens,
            total
        );

        let mut logs: String = "".to_string();
        let direct_logs: bool = accounts.len() < 100;

        for account in accounts {
            let amount_u128: u128 = account.amount.into();

            self.ft_on_transfer(
                account.account_id.clone(),
                account.amount,
            );

            if direct_logs {
                env::log_str(format!("Sending {} yFT to account @{}", amount_u128, account.account_id).as_str());
            } else {
                let log = format!("Sending {} yFT to account @{}\n", amount_u128, account.account_id);
                logs.push_str(&log);
            }
        }

        self.deposits.insert(account_id, tokens - total);

        if !direct_logs {
            env::log(format!("Done!\n{}", logs).as_bytes());
        }
    }
    
    //multisender transfer callback
    pub fn on_transfer_from_balance(&mut self, account_id: AccountId, amount_sent: U128, recipient: AccountId) {
        assert_self();

        let transfer_succeeded = is_promise_success();
        if !transfer_succeeded {
            env::log_str(format!("Transaction to @{} failed. {} yFT (~{} FT) kept on the app deposit", recipient, amount_sent.0, yocto_ft(amount_sent.0)).as_str());
            let previous_balance: u128 = self.get_deposit(account_id.clone()).into();
            self.deposits.insert(account_id, previous_balance + amount_sent.0);
        }
    }

}

pub fn assert_self() {
    assert_eq!(env::predecessor_account_id(), env::current_account_id());
}

fn is_promise_success() -> bool {
    assert_eq!(
        env::promise_results_count(),
        1,
        "Contract expected a result on the callback"
    );
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

pub fn yocto_ft(yocto_amount: Balance) -> Balance {
    yocto_amount / 10u128.pow(18)
}