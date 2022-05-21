import 'regenerator-runtime/runtime'
import React, {useRef} from 'react'
import {login, logout} from './utils'
import './global.css'
import './app.css'
import * as nearAPI from 'near-api-js'
import {BN} from 'bn.js'
import Big from 'big.js';
import ReactTooltip from 'react-tooltip';
import ReactFileReader from 'react-file-reader';
import {useDetectOutsideClick} from "./useDetectOutsideClick";
import {PublicKey} from 'near-api-js/lib/utils'
import {KeyType} from 'near-api-js/lib/utils/key_pair'

import getConfig from './config'
import getAppSettings from './app-settings'

const config = getConfig(process.env.NODE_ENV || 'development');
const appSettings = getAppSettings();

const FRAC_DIGITS = 11;
const gas = 300000000000000; 

function ConvertToYoctoNear(amount) {
    return new BN(amount).mul(new BN("1000000000000000000")).toString();
}
function Decimals(amount) {
    return new BN(Math.round(amount)).mul(new BN("1000000")).toString();
}

export default function App() {
    // when the user has not yet interacted with the form, disable the button
    const [sendButtonDisabled, setSendButtonDisabled] = React.useState(true);
    const [sendButtonUnsafeDisabled, setSendButtonUnsafeDisabled] = React.useState(true);
    const [checkButtonVisibility, setCheckButtonVisibility] = React.useState(false);
    const [depositButtonDisabled, setDepositButtonDisabled] = React.useState(true);
    const [depositAndSendButtonDisabled, setDepositAndSendButtonDisabled] = React.useState(true);
    const [depositAndSendButtonVisibility, setDepositAndSendButtonVisibility] = React.useState(true);
    const [textareaPlaceHolderVisibility, setTextareaPlaceHolderVisibility] = React.useState(true);

    const [chunkSize, setChunkSize] = React.useState(7); // or 100

    const navDropdownRef = React.useRef(null);
    const [isNavDropdownActive, setIsNaVDropdownActive] = useDetectOutsideClick(navDropdownRef, false);

    // after submitting the form, we want to show Notification
    const [showNotification, setShowNotification] = React.useState("");

    const [accounts, setAccounts] = React.useState({});
    const [accountsTextArea, setAccountsTextArea] = React.useState("");
    const [deposit, setDeposit] = React.useState(0.0);
    const [user_balance, setUserBalance] = React.useState(0.0);
    const [total, setTotal] = React.useState(0);
    const [amount, setAmount] = React.useState(0.0);
    const [chunkProcessingIndex, setChunkProcessingIndex] = React.useState(0);


    const setButtonsVisibility = (accounts, total, deposit, checkOtherButtons) => {
        if (checkOtherButtons === undefined)
            checkOtherButtons = false;

        const signedIn = window.walletConnection.isSignedIn();
        const accountsLength = accounts ? Object.keys(accounts).length : 0;
        setDepositButtonDisabled(!signedIn || !accountsLength || /*accountsLength < 150 || */deposit >= total || !total);
        setSendButtonDisabled(!signedIn || !accountsLength || deposit < total);
        setSendButtonUnsafeDisabled(!signedIn || !accountsLength || deposit < total);
        setCheckButtonVisibility(!signedIn || !accountsLength);
        const allButtonsDisabled = checkOtherButtons && depositButtonDisabled && sendButtonDisabled;
        setDepositAndSendButtonDisabled(!signedIn || !accountsLength || accountsLength > chunkSize);
        setDepositAndSendButtonVisibility(allButtonsDisabled || !(!signedIn || !accountsLength));
    };

    const getAccountsText = (accounts) => {
        return Object.keys(accounts).length ?
            Object.keys(accounts).reduce(function (acc, cur) {
                return acc + cur + " " + accounts[cur] + "\r";
            }, "")
            : "";
    };

    const UploadCSV = files => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const csv = reader.result.replace(/[, ]+/g, " ").trim(); // remove extra commas
            parseAmounts(csv)
        };
        reader.readAsText(files[0]);
    };

    const ParsedAccountsList = () => {
        let total = 0;
        let counter = 1;
        return Object.keys(accounts).length ?
            <ul className="accounts">
                {Object.keys(accounts).map(function (account_id) {
                    total += Number(accounts[account_id]);
                    const chuckIndex = Math.floor((counter) / chunkSize);
                    let liClassName = (chuckIndex < chunkProcessingIndex) ? "processed" : "";
                    return <li key={account_id} className={liClassName} data-chunk-index={chuckIndex}>
                        <div className="account" title={account_id}>{counter++}. {AccountTrim(account_id)}</div>
                        <div className="amount">{accounts[account_id]} FT</div>
                    </li>
                })}
                <TotalValue total={total}/>
            </ul> : null;
    };

    const Header = () => {
        return <div className="nav-container">
            <div className="nav-header">
                <NearLogo/>
                <div className="nav-item user-name">{window.accountId}</div>
                <Deposit/>
                <div className="nav align-right">
                    <NavMenu/>
                    <div className="account-sign-out">
                        <button className="link" style={{float: 'right'}} onClick={logout}>
                            Sign out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    };

    const Footer = () => {
        return <div className="footer">
            <div className="github">
                <div className="build-on-near"><a href="https://nearspace.info">BUILD ON NEAR</a></div>
                <div className="brand">NEAR {appSettings.appNme} | <a href={appSettings.github}
                                                                      rel="nofollow"
                                                                      target="_blank">Open Source</a></div>
            </div>
            <div className="promo">
                Made by <a href="https://github.com?YellingOilbird" rel="nofollow" target="_blank">GUACHARO</a>
            </div>
        </div>
    };


    const Deposit = () => {
        return deposit && Number(deposit) ?
            <div className="nav user-balance" data-tip="Your internal balance in Multisender App">
                {" App Balance: " + deposit + "FT"}
            </div>
            :
            null;
    };

    const NearLogo = () => {
        return <div className="logo-container content-desktop">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 414 162" className="near-logo">
                <g id="Layer_1" data-name="Layer 1">
                    <path className="polymorph"
                          d="M207.21,54.75v52.5a.76.76,0,0,1-.75.75H201a7.49,7.49,0,0,1-6.3-3.43l-24.78-38.3.85,19.13v21.85a.76.76,0,0,1-.75.75h-7.22a.76.76,0,0,1-.75-.75V54.75a.76.76,0,0,1,.75-.75h5.43a7.52,7.52,0,0,1,6.3,3.42l24.78,38.24-.77-19.06V54.75a.75.75,0,0,1,.75-.75h7.22A.76.76,0,0,1,207.21,54.75Z"
                    ></path>
                    <path className="polymorph"
                          d="M281,108h-7.64a.75.75,0,0,1-.7-1L292.9,54.72A1.14,1.14,0,0,1,294,54h9.57a1.14,1.14,0,0,1,1.05.72L324.8,107a.75.75,0,0,1-.7,1h-7.64a.76.76,0,0,1-.71-.48l-16.31-43a.75.75,0,0,0-1.41,0l-16.31,43A.76.76,0,0,1,281,108Z"
                    ></path>
                    <path className="polymorph"
                          d="M377.84,106.79,362.66,87.4c8.57-1.62,13.58-7.4,13.58-16.27,0-10.19-6.63-17.13-18.36-17.13H336.71a1.12,1.12,0,0,0-1.12,1.12h0a7.2,7.2,0,0,0,7.2,7.2H357c7.09,0,10.49,3.63,10.49,8.87s-3.32,9-10.49,9H336.71a1.13,1.13,0,0,0-1.12,1.13v26a.75.75,0,0,0,.75.75h7.22a.76.76,0,0,0,.75-.75V87.87h8.33l13.17,17.19a7.51,7.51,0,0,0,6,2.94h5.48A.75.75,0,0,0,377.84,106.79Z"
                    ></path>
                    <path className="polymorph"
                          d="M258.17,54h-33.5a1,1,0,0,0-1,1h0A7.33,7.33,0,0,0,231,62.33h27.17a.74.74,0,0,0,.75-.75V54.75A.75.75,0,0,0,258.17,54Zm0,45.67h-25a.76.76,0,0,1-.75-.75V85.38a.75.75,0,0,1,.75-.75h23.11a.75.75,0,0,0,.75-.75V77a.75.75,0,0,0-.75-.75H224.79a1.13,1.13,0,0,0-1.12,1.13v29.45a1.12,1.12,0,0,0,1.12,1.13h33.38a.75.75,0,0,0,.75-.75v-6.83A.74.74,0,0,0,258.17,99.67Z"
                    ></path>
                    <path className="polymorph"
                          d="M108.24,40.57,89.42,68.5a2,2,0,0,0,3,2.63l18.52-16a.74.74,0,0,1,1.24.56v50.29a.75.75,0,0,1-1.32.48l-56-67A9.59,9.59,0,0,0,47.54,36H45.59A9.59,9.59,0,0,0,36,45.59v70.82A9.59,9.59,0,0,0,45.59,126h0a9.59,9.59,0,0,0,8.17-4.57L72.58,93.5a2,2,0,0,0-3-2.63l-18.52,16a.74.74,0,0,1-1.24-.56V56.07a.75.75,0,0,1,1.32-.48l56,67a9.59,9.59,0,0,0,7.33,3.4h2a9.59,9.59,0,0,0,9.59-9.59V45.59A9.59,9.59,0,0,0,116.41,36h0A9.59,9.59,0,0,0,108.24,40.57Z"
                    ></path>
                </g>
            </svg>
            <div className="app-name">
                {appSettings.appNme}
            </div>
        </div>;
    };

    const NavMenu = () => {
        const onClick = () => setIsNaVDropdownActive(!isNavDropdownActive);

        return (
            <div className="nav-menu container">
                <div className="menu-container">
                    <button onClick={onClick} className="menu-trigger">
                        <span className="network-title">{config.networkId}</span>
                        <div className="network-icon"></div>
                    </button>
                    <nav
                        ref={navDropdownRef}
                        className={`menu ${isNavDropdownActive ? "active" : "inactive"}`}
                    >
                        <ul>
                            <li>
                                <a href={appSettings.urlMainnet}>Mainnet</a>
                            </li>
                            <li>
                                <a href={appSettings.urlTestnet}>Testnet</a>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        );
    };

    const TotalValue = (props) => {
        if (props && props.total)
            return <li key="total" className="total">
                <div className="account">Total</div>
                <div className="amount">{props.total.toFixed(2)} FT</div>
            </li>;
        else
            return null
    };

    let parseAmounts = function (input, pasteInProgress) {
        if (pasteInProgress === undefined)
            pasteInProgress = false;
        /*
        first character: [0-9a-zA-Z]
        account_id: [\_\-0-9a-zA-Z.]*
        separator: [\t,|\||=| ]
        amount ([0-9\.\,]+)
        */
        const pattern = RegExp(/^([0-9a-zA-Z][\_\-0-9a-zA-Z.]*)[\t,|\||=| ]([0-9\.\,]+$)/, 'gm');
        let accounts = {};
        let result;
        let total = 0;
        while ((result = pattern.exec(input)) !== null) {
            const account_name = result[1].toLowerCase();
            const amount = parseFloat(result[2].replace(',', '.').replace(' ', ''))
            if (result[1] && amount) {
                if (accounts.hasOwnProperty(account_name)) {
                    accounts[account_name] += amount;
                } else
                    accounts[account_name] = amount;

                total += amount;
            }
        }
        setTextareaPlaceHolderVisibility(!input.length);
        setTotal(total);
        setAccounts(accounts);
        if (!pasteInProgress) {
            setAccountsTextArea(input);
        }
        setButtonsVisibility(accounts, total, deposit, true);
    };

    const ActionButtons = useRef(null)

    const scrollToBottom = () => {
        ActionButtons.current.scrollIntoView({behavior: "smooth"});
    }
    
    const GetDeposit = async () => {

        const deposit = await window.contract.get_deposit({
            account_id: window.accountId
        });

        const depositFormatted = nearAPI.utils.format.formatNearAmount(deposit, FRAC_DIGITS).replace(",", "");
        const depositFormattedInDecimals = (Number(depositFormatted)*1000000).toString();
        setDeposit(depositFormattedInDecimals);
        console.log(depositFormattedInDecimals);
        return depositFormattedInDecimals;
    };

    function ChangeDeposit() {
        multisenderDeposit();
        transferDeposit();
    };

    const multisenderDeposit = async () => {
        const amount = ConvertToYoctoNear((total - deposit));
        setAmount(amount);
        console.log("deposited...",total - deposit);
        await window.contract.deposit({account_id : window.accountId, deposit_amount: amount.toString()}, gas);
    }
    const transferDeposit = async () => {
        const amount = ConvertToYoctoNear((total - deposit));
        setAmount(amount);
        const MULTISENDER_CONTRACT = "dev-1652445607364-51522207500129";
        await window.contractFT.ft_transfer({
            receiver_id : MULTISENDER_CONTRACT,
            amount: amount},
        gas, Big('0.000000000000000000000001').times(10 ** 24).toFixed());
    }

    const GetUserBalance = async () => {
        await window.contract.get_balance({
            account_id: window.accountId
        });
        const user_balance = await window.contract.get_user_balance({
            account_id: window.accountId
        })
        console.log(typeof user_balance);
        const user_balanceFormatted = nearAPI.utils.format.formatNearAmount(user_balance, FRAC_DIGITS).replace(",", "");

        const user_balanceInDecimals = (Number(user_balanceFormatted)*1000000).toString();
        console.log(typeof user_balanceInDecimals);
        setUserBalance(user_balanceInDecimals);
        console.log(user_balanceInDecimals);
        return user_balanceInDecimals;
    };

    // The useEffect hook can be used to fire side-effects during render
    // Learn more: https://reactjs.org/docs/hooks-intro.html
    React.useEffect(
        async () => {
            // in this case, we only care to query the contract when signed in
            if (window.walletConnection.isSignedIn()) {

                await GetUserBalance().then((balance) => {

                });
                await GetDeposit().then((deposit) => {
                    const accountsRaw = JSON.parse(window.localStorage.getItem('accounts'));

                    let accounts = {};
                    if (accountsRaw && accountsRaw.length) {
                        let total = 0;
                        Object.keys(accountsRaw).map(function (index) {
                            const amount = nearAPI.utils.format.formatNearAmount(accountsRaw[index].amount, FRAC_DIGITS).replace(",", "");
                            total += Number(amount);
                            accounts[accountsRaw[index].account_id] = amount;
                        });
                        setTextareaPlaceHolderVisibility(false);
                        setAccounts(accounts);
                        setAccountsTextArea(getAccountsText(accounts));
                        setTotal(total);
                        setButtonsVisibility(accounts, total, deposit, true);
                    }
                });
            }
        },

        // The second argument to useEffect tells React when to re-run the effect
        // Use an empty array to specify "only run on first render"
        // This works because signing into NEAR Wallet reloads the page
        []
    )

    // if not signed in, return early with sign-in prompt
    if (!window.walletConnection.isSignedIn()) {
        return (
            <>
                <Header/>
                <main>
                    <h1>{appSettings.appNme}</h1>
                    <p>
                        {appSettings.appDescription}
                    </p>
                    <p>
                        To make use of the NEAR blockchain, you need to sign in. The button
                        below will sign you in using NEAR Wallet.
                    </p>
                    <p style={{textAlign: 'center', marginTop: '2.5em'}}>
                        <button onClick={login}>Sign in</button>
                    </p>
                </main>
                <Footer/>
            </>
        )
    }

    const handlePaste = (event) => {
        let {value, selectionStart, selectionEnd} = event.target;
        let pastedValue = event.clipboardData.getData("text");
        let pre = value.substring(0, selectionStart);
        let post = value.substring(selectionEnd, value.length);
        value = (pre + pastedValue + post).trim();
        parseAmounts(value, true);
    };

    return (
        // use React Fragment, <>, to avoid wrapping elements in unnecessary divs
        <>
            <Header/>
            <main>
                <div className="background-img"/>
                <h1>
                    Fungible Token Multisender Tool
                </h1>
                
                <div className="row">
                    <div className="btn upload-csv-button">
                    <button
                    style={{ 
                        borderRadius: '10', 
                        color: '#04AA6D', /* Green background */
                        border: '3px solid gray', /* Green border */
                        color: 'white', /* White text */
                        float: 'left'
                    }}
                    onClick={ async event => {
                    event.preventDefault()
                    ReactTooltip.hide();
                    await window.contractFT.storage_deposit({account_id : window.accountId}, gas, '1250000000000000000000');
                    console.log("success deposited storage...",deposit);
                    }}
                    data-tip={`storage deposit to token contract (like registration)`}
                  >
                  Request FT Storage 
                </button>
                    </div>
                    <div className="column">
                        <div className="balance">FT balance: {user_balance}</div>
                    </div>
                    <div className="column">
                        <div className="balance">FT deposited: {deposit}</div>
                    </div>
                </div>
                <br></br>
                <div>
                        <label
                            style={{
                                display: 'block',
                                color: 'var(--gray)',
                            }}
                        >
                            Recipients and amounts
                        </label>
                        <label
                            style={{
                                display: 'block',
                                color: 'var(--gray)',
                                fontSize: '0.6em',
                                marginBottom: '0.5em'
                            }}
                        >
                            Enter one address and amount in token on each line. Supports any format.
                        </label>
                </div>

                <form>
                    <fieldset id="fieldset">
                        <div className="accounts-textarea">
                                  <textarea
                                      autoFocus
                                      autoComplete="off"
                                      id="accounts"
                                      defaultValue={accountsTextArea}
                                      onChange={e => parseAmounts(e.target.value)}
                                      onPaste={e => handlePaste(e)}
                                  />
                            {
                                textareaPlaceHolderVisibility &&
                                <div className="accounts-placeholder">
                                    account1.near 3.141592<br/>
                                    account2.near,2.7182<br/>
                                    account3.near=1.41421
                                </div>
                            }
                        </div>

                        <div className="action-buttons">
                            <button
                                disabled={checkButtonVisibility}
                                className={`verify-button send-button ${checkButtonVisibility ? "hidden" : ""}`}
                                onClick={async event => {
                                    event.preventDefault();
                                    ReactTooltip.hide();

                                    // disable the form while the value gets updated on-chain
                                    fieldset.disabled = true

                                    const connection = getNearAccountConnection();
                                    const allAccountKeys = Object.keys(accounts);
                                    let validAccountsFiltered = [];
                                    let total = 0;

                                    const groupSize = 500;
                                    let groupIndex = -1;
                                    let accountGroups = [];
                                    for (let i = 0; i < allAccountKeys.length; i++) {
                                        if (i % groupSize === 0) {
                                            groupIndex++;
                                            accountGroups[groupIndex] = [];
                                        }

                                        accountGroups[groupIndex].push(allAccountKeys[i])
                                    }

                                    let group = 0;
                                    while (group < accountGroups.length) {
                                        let checkAccountGroup = async () => {
                                            return await Promise.all(accountGroups[group].map(async account => {
                                                    let valid = await accountExists(connection, account).then();
                                                    if (valid) {
                                                        return account;
                                                    } else {
                                                        console.log("Invalid account: " + account);
                                                    }
                                                }
                                            ));
                                        }

                                        await checkAccountGroup().then((validAccounts) => {
                                            Object.values(validAccounts).map(account => {
                                                if (account) {
                                                    validAccountsFiltered[account] = accounts[account];
                                                    total += parseFloat(accounts[account]);
                                                }
                                            });
                                        });

                                        group++;
                                    }

                                    const removed = Object.keys(accounts).length - Object.keys(validAccountsFiltered).length;
                                    setAccounts(validAccountsFiltered);
                                    setAccountsTextArea(getAccountsText(validAccountsFiltered));
                                    setTotal(total);
                                    setButtonsVisibility(validAccountsFiltered, total, deposit, true);

                                    fieldset.disabled = false
                                    // show Notification
                                    if (removed > 0)
                                        setShowNotification({
                                            method: "text",
                                            data: `Removed ${removed} invalid account(s)`
                                        });
                                    else
                                        setShowNotification({
                                            method: "text",
                                            data: `All accounts are valid`
                                        });

                                    if (total)
                                        scrollToBottom();

                                    // remove Notification again after css animation completes
                                    // this allows it to be shown again next time the form is submitted
                                    setTimeout(() => {
                                        setShowNotification("")
                                    }, 11000)
                                }}
                                data-tip={"Remove invalid accounts from the list"}>
                                Verify accounts
                            </button>
                        </div>

                        <ParsedAccountsList/>

                        {!sendButtonDisabled && <>
                            <div className="warning-text">Please double check account list and total amount before to
                                send
                                funds.
                            </div>
                            <div className="warning-text">Blockchain transactions are invertible.</div>
                        </>}

                        <div className="action-buttons action-buttons-last" ref={ActionButtons}>
                            

                            <button
                                disabled={sendButtonUnsafeDisabled}
                                className={`send-button ${sendButtonUnsafeDisabled ? "hidden" : ""}`}
                                onClick={async event => {
                                    event.preventDefault()
                                    ReactTooltip.hide();

                                    let _chunkSize = 100;
                                    setChunkSize(_chunkSize);
                                    console.log("Chunk size: " + _chunkSize);

                                    // disable the form while the value gets updated on-chain
                                    fieldset.disabled = true

                                    try {
                                        let multisenderAccounts = Object.keys(accounts).reduce(function (acc, cur) {
                                            acc.push({account_id: cur, amount: ConvertToYoctoNear(accounts[cur])})
                                            return acc;
                                        }, []);

                                        SaveAccountsToLocalStorage(multisenderAccounts);

                                        let promises = [];

                                        const chunks = multisenderAccounts.reduce(function (result, value, index, array) {
                                            if (index % _chunkSize === 0) {
                                                const max_slice = Math.min(index + _chunkSize, multisenderAccounts.length);
                                                result.push(array.slice(index, max_slice));
                                            }
                                            return result;
                                        }, []);

                                        const ret = await (chunks).reduce(
                                            async (promise, chunk, index) => {
                                                return promise.then(async last => {
                                                    const ret = last + 100;
                                                    const max_slice = Math.min((index + 1) * _chunkSize, multisenderAccounts.length);
                                                    const remainingAccounts = multisenderAccounts.slice(max_slice);

                                                    SaveAccountsToLocalStorage(remainingAccounts);

                                                    await new Promise(async (res, rej) => {
                                                        await window.contract.multisend_from_balance_unsafe({
                                                            accounts: chunk
                                                        }, gas).then(() => {
                                                            setChunkProcessingIndex(index + 1);
                                                        })

                                                        return setTimeout(res, 100);
                                                    });
                                                    return ret;
                                                })
                                            }, Promise.resolve(0)).then(() => {
                                            setButtonsVisibility([], 0, deposit, true);
                                            setShowNotification({
                                                method: "complete",
                                                data: "multisend_from_balance_unsafe"
                                            });
                                            GetDeposit();
                                        });
                                    } catch (e) {
                                        alert(
                                            'Something went wrong! \n' +
                                            'Check your browser console for more info.\n' +
                                            e.toString()
                                        )
                                        throw e
                                    } finally {
                                        // re-enable the form, whether the call succeeded or failed
                                        fieldset.disabled = false
                                    }
                                }}
                                data-tip={"Multi send to all recipients using your internal balance by 100 txs. BETTER GAS EFFICIENCY BY IGNORING TRANSFER STATUS. Always Verify Accounts before."}>
                                Send Unsafe from App Balance
                            </button>

                            <button
                                onClick={ async event => {
                                    event.preventDefault()
                                    ReactTooltip.hide();
                                    ChangeDeposit();
                                }}
                                data-tip={`Deposit ${total - deposit} tokens to the Multisender App`}
                            >
                                Deposit {total - deposit} FT
                            </button>

                            <button
                                onClick={ async event => {
                                    event.preventDefault()
                                    ReactTooltip.hide();
                                    await window.contract.withdraw_all({account_id : window.accountId}, gas);
                                    console.log("success withdraw...",deposit);
                                }}
                                data-tip={`Withdraw all tokens from the Multisender App deposit`}
                            >
                                Withdraw all
                            </button>
                            <br></br>
                            <br></br>
                            <br></br>
                            <label
                            style={{
                                display: 'block',
                                color: 'var(--gray)',
                            }}>
                            Send FT using single transaction
                            </label>
                            <div style={{ 
                                display: 'flex',
                                marginBottom: '1rem',
                                color: 'black'}}>
                                <input
                                    autoComplete="off"
                                    defaultValue='oilbird.testnet'
                                    id="transfer_address"
                                    style={{borderRadius: '5px 5px 5px 5px'}}
                                  />
                                </div>
                                <div style={{ display: 'flex', color: 'black'}}>
                                  <input
                                    autoComplete="off"
                                    defaultValue={0}
                                    id="transfer_amount"
                                />
                                <button
                                  style={{ borderRadius: '0 5px 5px 0' }}
                                  onClick={ async event => {
                                    event.preventDefault()
                                    ReactTooltip.hide();
                                    const transfer_amount = Number(document.getElementById('transfer_amount').value);
                                    await window.contract.ft_on_transfer({ 
                                        receiver_id: document.getElementById('transfer_address').value,
                                        amount: ConvertToYoctoNear(transfer_amount)
                                    }, gas, Big('0.000000000000000000000001').times(10 ** 24).toFixed()); //change to '1'
                                    console.log("sending...");
                                  }}
                                >
                                  Send
                                </button>
                            </div>
                            


                            <button
                                disabled={depositButtonDisabled}
                                className={`deposit-button ${depositButtonDisabled ? "hidden" : ""}`}
                                onClick={async event => {
                                    event.preventDefault()
                                    ReactTooltip.hide();

                                    // disable the form while the value gets updated on-chain
                                    fieldset.disabled = true;

                                    try {

                                        let multisenderAccounts = Object.keys(accounts).reduce(function (acc, cur) {
                                            acc.push({account_id: cur, amount: ConvertToYoctoNear(accounts[cur])})
                                            return acc;
                                        }, []);

                                        SaveAccountsToLocalStorage(multisenderAccounts);
////////////////////////////////////
                                        const amount = ConvertToYoctoNear(total - deposit);
                                        console.log("deposited...",amount);
                                        await window.contract.deposit({account_id : window.accountId, deposit_amount: amount}, gas);

                                    } catch (e) {
                                        alert(
                                            'Something went wrong! \n' +
                                            'Check your browser console for more info.\n' +
                                            e.toString()
                                        )
                                        throw e
                                    } finally {
                                        // re-enable the form, whether the call succeeded or failed
                                        fieldset.disabled = false
                                    }

                                    // show Notification
                                    setShowNotification({method: "call", data: "deposit"})

                                    // remove Notification again after css animation completes
                                    // this allows it to be shown again next time the form is submitted
                                    setTimeout(() => {
                                        setShowNotification("")
                                    }, 11000)
                                }}
                                data-tip="Deposit tokens to the Multisender App and come back to perform multi send. Option for Ledger holders and for those who have too many tasks for a single transaction. ">
                                {`Deposit ${(total - deposit).toFixed(2)}FT`}
                            </button>
                        </div>

                    </fieldset>
                </form>
            </main>

            <Footer/>

            {showNotification && Object.keys(showNotification) &&
            <Notification method={showNotification.method} data={showNotification.data}/>}
            <ReactTooltip/>
        </>
    )
}

function getNearAccountConnection() {
    if (!window.connection) {
        const provider = new nearAPI.providers.JsonRpcProvider(config.nodeUrl);
        window.connection = new nearAPI.Connection(config.nodeUrl, provider, {});
    }
    return window.connection;
}

async function accountExists(connection, accountId) {
    if (accountId.length === 44) {
        let key = new PublicKey({keyType: KeyType.ED25519, data: Buffer.from(accountId, 'hex')});
        return !!(key.toString())
    }

    try {
        await new nearAPI.Account(connection, accountId).state();
        return true;
    } catch (error) {
        return false;
    }
}

function SaveAccountsToLocalStorage(accounts) {
    window.localStorage.setItem('accounts', accounts ? JSON.stringify(accounts) : "[]");
}

// this component gets rendered by App after the form is submitted
function Notification(props) {
    const urlPrefix = `https://explorer.${config.networkId}.near.org/accounts`
    if (props.method === "call")
        return (
            <aside>
                <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.accountId}`}>
                    {window.accountId}
                </a>
                {' '/* React trims whitespace around tags; insert literal space character when needed */}
                called method: '{props.data}' in contract:
                {' '}
                <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.contract.contractId}`}>
                    {window.contract.contractId}
                </a>
                <footer>
                    <div>✔ Succeeded</div>
                    <div>Just now</div>
                </footer>
            </aside>
        )
    else if (props.method === "complete")
        return (
            <aside>
                Request: '{props.data}' complete! Please check the contract:
                {' '}
                <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.contract.contractId}`}>
                    {window.contract.contractId}
                </a>
                <footer>
                    <div>✔ Succeeded</div>
                    <div>Just now</div>
                </footer>
            </aside>
        )
    else if (props.method === "text")
        return (
            <aside>
                {props.data}
                <footer>
                    <div>✔ Succeeded</div>
                    <div>Just now</div>
                </footer>
            </aside>
        )
    else return (
            <aside/>
        )
}

function AccountTrim(account_id) {
    if (account_id.length > 14 + 14 + 1)
        return account_id.slice(0, 14) + '…' + account_id.slice(-14);
    else
        return account_id;
}