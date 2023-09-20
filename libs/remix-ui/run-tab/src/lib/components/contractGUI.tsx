// eslint-disable-next-line no-use-before-define
import React, {useEffect, useRef, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import * as remixLib from '@remix-project/remix-lib'
import {ContractGUIProps} from '../types'
import {CopyToClipboard} from '@remix-ui/clipboard'
import {
  CustomTooltip,
  ProxyAddressToggle,
  ProxyDropdownMenu,
  shortenDate,
  shortenProxyAddress,
  unavailableProxyLayoutMsg,
  upgradeReportMsg
} from '@remix-ui/helper'
import {Dropdown} from 'react-bootstrap'
import {FhevmInstance} from 'fhevmjs/web'
import {getInstance} from '../fhevm'

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')

const txFormat = remixLib.execution.txFormat
const txHelper = remixLib.execution.txHelper
export function ContractGUI(props: ContractGUIProps) {
  const [instance, setInstance] = useState<FhevmInstance>()
  const [title, setTitle] = useState<string>('')
  const [basicInput, setBasicInput] = useState<string>('')
  const [toggleContainer, setToggleContainer] = useState<boolean>(false)
  const [buttonOptions, setButtonOptions] = useState<{
    title: string
    content: string
    classList: string
    dataId: string
  }>({title: '', content: '', classList: '', dataId: ''})
  const [toggleDeployProxy, setToggleDeployProxy] = useState<boolean>(false)
  const [toggleUpgradeImp, setToggleUpgradeImp] = useState<boolean>(false)
  const [deployState, setDeployState] = useState<{
    deploy: boolean
    upgrade: boolean
  }>({deploy: false, upgrade: false})
  const [proxyAddress, setProxyAddress] = useState<string>('')
  const [proxyAddressError, setProxyAddressError] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState<boolean>(false)
  const multiFields = useRef<Array<HTMLInputElement | null>>([])
  const multiSelects = useRef<Array<HTMLSelectElement | null>>([])
  const initializeFields = useRef<Array<HTMLInputElement | null>>([])
  const basicInputRef = useRef<HTMLInputElement>()
  const intl = useIntl()

  useEffect(() => {
    setInstance(getInstance())
  }, [getInstance()])

  useEffect(() => {
    if (props.deployOption && Array.isArray(props.deployOption)) {
      if (
        props.deployOption[0] &&
        props.deployOption[0].title === 'Deploy with Proxy' &&
        props.deployOption[0].active
      )
        handleDeployProxySelect(true)
      else if (
        props.deployOption[1] &&
        props.deployOption[1].title === 'Upgrade with Proxy' &&
        props.deployOption[1].active
      )
        handleUpgradeImpSelect(true)
    }
  }, [props.deployOption])

  useEffect(() => {
    if (props.title) {
      setTitle(props.title)
    } else if (props.funcABI.name) {
      setTitle(props.funcABI.name)
    } else {
      setTitle(props.funcABI.type === 'receive' ? '(receive)' : '(fallback)')
    }
    setBasicInput('')
    // we have the reset the fields before reseting the previous references.
    basicInputRef.current.value = ''
    multiFields.current
      .filter((el) => el !== null && el !== undefined)
      .forEach((el) => (el.value = ''))
    multiFields.current = []
    multiSelects.current = []
  }, [props.title, props.funcABI])

  useEffect(() => {
    if (props.lookupOnly) {
      //   // call. stateMutability is either pure or view
      setButtonOptions({
        title: title + ' - call',
        content: 'call',
        classList: 'btn-info',
        dataId: title + ' - call'
      })
    } else if (
      props.funcABI.stateMutability === 'payable' ||
      props.funcABI.payable
    ) {
      //   // transact. stateMutability = payable
      setButtonOptions({
        title: title + ' - transact (payable)',
        content: 'transact',
        classList: 'btn-danger',
        dataId: title + ' - transact (payable)'
      })
    } else {
      //   // transact. stateMutability = nonpayable
      setButtonOptions({
        title: title + ' - transact (not payable)',
        content: 'transact',
        classList: 'btn-warning',
        dataId: title + ' - transact (not payable)'
      })
    }
  }, [props.lookupOnly, props.funcABI, title])

  const getEncodedCall = () => {
    console.log('getEncodedCall')
    const multiString = getMultiValsString(
      multiFields.current,
      multiSelects.current
    )
    // copy-to-clipboard icon is only visible for method requiring input params
    if (!multiString) {
      return 'cannot encode empty arguments'
    }
    const multiJSON = JSON.parse('[' + multiString + ']')

    const encodeObj = txFormat.encodeData(
      props.funcABI,
      multiJSON,
      props.funcABI.type === 'constructor' ? props.evmBC : null
    )

    if (encodeObj.error) {
      console.error(encodeObj.error)
      return encodeObj.error
    } else {
      return encodeObj.data
    }
  }

  const getEncodedParams = () => {
    try {
      console.log('getEncodedParams')
      const multiString = getMultiValsString(
        multiFields.current,
        multiSelects.current
      )
      // copy-to-clipboard icon is only visible for method requiring input params
      if (!multiString) {
        return 'cannot encode empty arguments'
      }
      const multiJSON = JSON.parse('[' + multiString + ']')
      return txHelper.encodeParams(props.funcABI, multiJSON)
    } catch (e) {
      console.error(e)
    }
  }

  const switchMethodViewOn = () => {
    setToggleContainer(true)
    makeMultiVal()
  }

  const switchMethodViewOff = () => {
    setToggleContainer(false)
    console.log('switchMethodViewOff')
    const multiValString = getMultiValsString(
      multiFields.current,
      multiSelects.current
    )

    if (multiValString) setBasicInput(multiValString)
  }

  const getMultiValsString = (
    fields: HTMLInputElement[],
    selects?: HTMLSelectElement[]
  ) => {
    const valArray = fields
    let ret = ''
    const valArrayTest = []

    for (let j = 0; j < valArray.length; j++) {
      if (ret !== '') ret += ','
      let elVal = valArray[j] ? valArray[j].value : ''
      const selectValue = selects[j] ? selects[j].value : ''

      valArrayTest.push(elVal)
      switch (selectValue) {
        case '1': {
          if (elVal.substring(0, 2) !== '0x') {
            try {
              elVal = `0x${toHexString(instance.encrypt8(+elVal))}`
            } catch (e) {}
          }
          break
        }
        case '8': {
          if (elVal.substring(0, 2) !== '0x') {
            try {
              elVal = `0x${toHexString(instance.encrypt8(+elVal))}`
            } catch (e) {}
          }
          break
        }

        case '16': {
          if (elVal.substring(0, 2) !== '0x') {
            try {
              elVal = `0x${toHexString(instance.encrypt16(+elVal))}`
            } catch (e) {}
          }
          break
        }

        case '32': {
          if (elVal.substring(0, 2) !== '0x') {
            try {
              elVal = `0x${toHexString(instance.encrypt32(+elVal))}`
            } catch (e) {}
          }
          break
        }

        default: {
          elVal = elVal.replace(/(^|,\s+|,)(\d+)(\s+,|,|$)/g, '$1"$2"$3') // replace non quoted number by quoted number
          elVal = elVal.replace(
            /(^|,\s+|,)(0[xX][0-9a-fA-F]+)(\s+,|,|$)/g,
            '$1"$2"$3'
          ) // replace non quoted hex string by quoted hex string
          if (elVal) {
            try {
              JSON.parse(elVal)
            } catch (e) {
              elVal = '"' + elVal + '"'
            }
          }
        }
      }
      ret += elVal
    }
    const valStringTest = valArrayTest.join('')

    if (valStringTest) {
      return ret
    } else {
      return ''
    }
  }

  const makeMultiVal = () => {
    const inputString = basicInput

    if (inputString) {
      const inputJSON =
        remixLib.execution.txFormat.parseFunctionParams(inputString)
      const multiInputs = multiFields.current

      for (let k = 0; k < multiInputs.length; k++) {
        if (inputJSON[k]) {
          multiInputs[k].value = JSON.stringify(inputJSON[k])
        }
      }
    }
  }

  const handleActionClick = async () => {
    if (deployState.deploy) {
      console.log('handleActionClick')
      const proxyInitializeString = getMultiValsString(initializeFields.current)
      props.clickCallBack(
        props.initializerOptions.inputs.inputs,
        proxyInitializeString,
        ['Deploy with Proxy']
      )
    } else if (deployState.upgrade) {
      if (proxyAddress === '') {
        setProxyAddressError('proxy address cannot be empty')
      } else {
        const isValidProxyAddress = await props.isValidProxyAddress(
          proxyAddress
        )
        if (isValidProxyAddress) {
          setProxyAddressError('')
          const upgradeReport: any = await props.isValidProxyUpgrade(
            proxyAddress
          )
          if (upgradeReport.ok) {
            !proxyAddressError &&
              props.clickCallBack(props.funcABI.inputs, proxyAddress, [
                'Upgrade with Proxy'
              ])
          } else {
            if (upgradeReport.warning) {
              props.modal(
                'Proxy Upgrade Warning',
                unavailableProxyLayoutMsg(),
                'Proceed',
                () => {
                  !proxyAddressError &&
                    props.clickCallBack(props.funcABI.inputs, proxyAddress, [
                      'Upgrade with Proxy'
                    ])
                },
                'Cancel',
                () => {},
                'btn-warning',
                'btn-secondary'
              )
            } else {
              props.modal(
                'Proxy Upgrade Error',
                upgradeReportMsg(upgradeReport),
                'Continue anyway ',
                () => {
                  !proxyAddressError &&
                    props.clickCallBack(props.funcABI.inputs, proxyAddress, [
                      'Upgrade with Proxy'
                    ])
                },
                'Cancel',
                () => {},
                'btn-warning',
                'btn-secondary'
              )
            }
          }
        } else {
          setProxyAddressError('not a valid contract address')
        }
      }
    } else {
      props.clickCallBack(props.funcABI.inputs, basicInput)
    }
  }

  const handleBasicInput = (e) => {
    const value = e.target.value

    setBasicInput(value)
  }

  const handleExpandMultiClick = () => {
    console.log('handleExpandMultiClick')
    const valsString = getMultiValsString(
      multiFields.current,
      multiSelects.current
    )

    if (valsString) {
      props.clickCallBack(props.funcABI.inputs, valsString)
    } else {
      props.clickCallBack(props.funcABI.inputs, '')
    }
  }

  const handleToggleDeployProxy = () => {
    setToggleDeployProxy(!toggleDeployProxy)
  }

  const handleDeployProxySelect = (value: boolean) => {
    if (value) setToggleUpgradeImp(false)
    setToggleDeployProxy(value)
    setDeployState({upgrade: false, deploy: value})
  }

  const handleToggleUpgradeImp = () => {
    setToggleUpgradeImp(!toggleUpgradeImp)
  }

  const handleUpgradeImpSelect = (value: boolean) => {
    setToggleUpgradeImp(value)
    if (value) {
      setToggleDeployProxy(false)
    }
    setDeployState({deploy: false, upgrade: value})
  }

  const switchProxyAddress = (address: string) => {
    setProxyAddress(address)
  }

  const toggleDropdown = (isOpen: boolean) => {
    setShowDropdown(isOpen)
  }

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const address = e.target.value

    setProxyAddress(address)
  }

  const generateToken = async () => {
    if (
      props.reencryptInputs?.publicKey != null &&
      props.reencryptInputs?.signature != null
    ) {
      const token = await props.getContractToken(props.contractAddress)
      const publicKey = `0x${toHexString(token.publicKey)}`
      multiFields.current[props.reencryptInputs.publicKey].value = publicKey
      setBasicInput(publicKey)
      multiFields.current[props.reencryptInputs.signature].value =
        token.signature
      setBasicInput(token.signature)
    }
  }

  return (
    <div
      className={`udapp_contractProperty ${
        (props.funcABI.inputs && props.funcABI.inputs.length > 0) ||
        props.funcABI.type === 'fallback' ||
        props.funcABI.type === 'receive'
          ? 'udapp_hasArgs'
          : ''
      }`}
    >
      <div
        className="udapp_contractActionsContainerSingle pt-2"
        style={{display: toggleContainer ? 'none' : 'flex'}}
      >
        <CustomTooltip
          delay={0}
          placement={'right'}
          tooltipClasses="text-wrap"
          tooltipId="remixUdappInstanceButtonTooltip"
          tooltipText={
            toggleUpgradeImp && !proxyAddress
              ? 'Proxy address cannot be empty'
              : props.inputs !== '' && basicInput === ''
                ? 'Input required'
                : buttonOptions.title
          }
        >
          <div
            className="d-flex wrapperElement"
            onClick={handleActionClick}
            data-id={buttonOptions.dataId}
            data-title={buttonOptions.title}
          >
            <button
              className={`udapp_instanceButton text-nowrap overflow-hidden text-truncate ${props.widthClass} btn btn-sm ${buttonOptions.classList}`}
              data-id={buttonOptions.dataId}
              data-title={buttonOptions.title}
              disabled={
                (toggleUpgradeImp && !proxyAddress) ||
                props.disabled ||
                (props.inputs !== '' && basicInput === '')
              }
              style={{pointerEvents: 'none'}}
            >
              {title}
            </button>
          </div>
        </CustomTooltip>
        <input
          className="form-control"
          data-id={
            props.funcABI.type === 'fallback' ||
            props.funcABI.type === 'receive'
              ? `'(${props.funcABI.type}')`
              : 'multiParamManagerBasicInputField'
          }
          placeholder={props.inputs}
          onChange={handleBasicInput}
          data-title={
            props.funcABI.type === 'fallback' ||
            props.funcABI.type === 'receive'
              ? `'(${props.funcABI.type}')`
              : props.inputs
          }
          ref={basicInputRef}
          style={{
            height: '2rem',
            visibility: !(
              (props.funcABI.inputs && props.funcABI.inputs.length > 0) ||
              props.funcABI.type === 'fallback' ||
              props.funcABI.type === 'receive'
            )
              ? 'hidden'
              : 'visible'
          }}
        />
        <i
          className="fas fa-angle-down udapp_methCaret"
          onClick={switchMethodViewOn}
          style={{
            visibility: !(
              props.funcABI.inputs && props.funcABI.inputs.length > 0
            )
              ? 'hidden'
              : 'visible'
          }}
        ></i>
      </div>
      <div
        className="udapp_contractActionsContainerMulti"
        style={{display: toggleContainer ? 'flex' : 'none'}}
      >
        <div className="udapp_contractActionsContainerMultiInner text-dark">
          <div onClick={switchMethodViewOff} className="udapp_multiHeader">
            <div className="udapp_multiTitle run-instance-multi-title pt-3">
              {title}
            </div>
            <i className="fas fa-angle-up udapp_methCaret"></i>
          </div>
          <div>
            {props.funcABI.inputs.map((inp, index) => {
              const isPubKey = props.reencryptInputs?.publicKey === index
              const isSignature = props.reencryptInputs?.signature === index
              return (
                <div className="udapp_multiArg" key={index}>
                  <label htmlFor={inp.name}> {inp.name}: </label>
                  <CustomTooltip
                    placement="left-end"
                    tooltipId="udappContractActionsTooltip"
                    tooltipClasses="text-nowrap"
                    tooltipText={inp.name}
                  >
                    <>
                      <input
                        ref={(el) => {
                          multiFields.current[index] = el
                        }}
                        className="form-control"
                        placeholder={inp.type}
                        data-id={`multiParamManagerInput${inp.name}`}
                        onChange={handleBasicInput}
                      />
                      {(isSignature || isPubKey) && instance && (
                        <button
                          className="btn"
                          style={{minWidth: '100px'}}
                          onClick={generateToken}
                        >
                          🔄 Generate
                        </button>
                      )}
                      {!isSignature && inp.type === 'bytes' && instance && (
                        <select
                          ref={(el) => {
                            multiSelects.current[index] = el
                          }}
                          className="form-control custom-select"
                        >
                          <option value="">none</option>
                          <option value="1">ebool</option>
                          <option value="8">euint32</option>
                          <option value="16">euint16</option>
                          <option value="32">euint32</option>
                        </select>
                      )}
                    </>
                  </CustomTooltip>
                </div>
              )
            })}
          </div>
          <div className="d-flex udapp_group udapp_multiArg">
            <CopyToClipboard
              tip={intl.formatMessage({id: 'udapp.copyCalldata'})}
              icon="fa-clipboard"
              direction={'bottom'}
              getContent={getEncodedCall}
            >
              <button className="btn remixui_copyButton">
                <i
                  id="copyCalldata"
                  className="m-0 remixui_copyIcon far fa-copy"
                  aria-hidden="true"
                ></i>
                <label htmlFor="copyCalldata">Calldata</label>
              </button>
            </CopyToClipboard>
            <CopyToClipboard
              tip={intl.formatMessage({id: 'udapp.copyParameters'})}
              icon="fa-clipboard"
              direction={'bottom'}
              getContent={getEncodedParams}
            >
              <button className="btn remixui_copyButton">
                <i
                  id="copyParameters"
                  className="m-0 remixui_copyIcon far fa-copy"
                  aria-hidden="true"
                ></i>
                <label htmlFor="copyParameters">
                  <FormattedMessage id="udapp.parameters" />
                </label>
              </button>
            </CopyToClipboard>
            <CustomTooltip
              placement={'right'}
              tooltipClasses="text-nowrap"
              tooltipId="remixUdappInstanceButtonTooltip"
              tooltipText={buttonOptions.title}
            >
              <div onClick={handleExpandMultiClick}>
                <button
                  type="button"
                  data-id={buttonOptions.dataId}
                  className={`udapp_instanceButton btn ${buttonOptions.classList}`}
                  disabled={
                    props.disabled || (props.inputs !== '' && basicInput === '')
                  }
                >
                  {buttonOptions.content}
                </button>
              </div>
            </CustomTooltip>
          </div>
        </div>
      </div>
      {props.deployOption && (props.deployOption || []).length > 0 ? (
        <>
          <div className="d-flex justify-content-between mt-3">
            <div className="d-flex py-1 align-items-center custom-control custom-checkbox">
              <input
                id="deployWithProxy"
                data-id="contractGUIDeployWithProxy"
                className="form-check-input custom-control-input"
                type="checkbox"
                onChange={(e) => handleDeployProxySelect(e.target.checked)}
                checked={deployState.deploy}
              />
              <label
                htmlFor="deployWithProxy"
                data-id="contractGUIDeployWithProxyLabel"
                className="m-0 form-check-label w-100 custom-control-label udapp_checkboxAlign"
              >
                <FormattedMessage id="udapp.deployWithProxy" />
              </label>
            </div>
            <div>
              {props.initializerOptions &&
              props.initializerOptions.initializeInputs ? (
                  <span onClick={handleToggleDeployProxy}>
                    <i
                      className={
                        !toggleDeployProxy
                          ? 'fas fa-angle-right pt-2'
                          : 'fas fa-angle-down'
                      }
                      aria-hidden="true"
                    ></i>
                  </span>
                ) : null}
            </div>
          </div>
          {props.initializerOptions &&
          props.initializerOptions.initializeInputs ? (
              <div
                className={`pl-4 flex-column ${
                  toggleDeployProxy ? 'd-flex' : 'd-none'
                }`}
              >
                <div className={`flex-column 'd-flex'}`}>
                  {props.initializerOptions.inputs.inputs.map((inp, index) => {
                    return (
                      <div className="mb-2" key={index}>
                        <label
                          className="mt-2 text-left d-block"
                          htmlFor={inp.name}
                        >
                          {' '}
                          {inp.name}:{' '}
                        </label>
                        <input
                          ref={(el) => {
                            initializeFields.current[index] = el
                          }}
                          style={{height: 32}}
                          className="form-control udapp_input"
                          placeholder={inp.type}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          <div className="d-flex justify-content-between">
            <div className="d-flex py-1 align-items-center custom-control custom-checkbox">
              <input
                id="upgradeImplementation"
                data-id="contractGUIUpgradeImplementation"
                className="form-check-input custom-control-input"
                type="checkbox"
                onChange={(e) => handleUpgradeImpSelect(e.target.checked)}
                checked={deployState.upgrade}
              />
              <label
                htmlFor="upgradeImplementation"
                data-id="contractGUIUpgradeImplementationLabel"
                className="m-0 form-check-label custom-control-label udapp_checkboxAlign"
              >
                <FormattedMessage id="udapp.upgradeWithProxy" />
              </label>
            </div>
            <span onClick={handleToggleUpgradeImp}>
              <i
                className={
                  !toggleUpgradeImp
                    ? 'fas fa-angle-right pt-2'
                    : 'fas fa-angle-down'
                }
                aria-hidden="true"
              ></i>
            </span>
          </div>
          <div
            className={`pl-4 flex-column ${
              toggleUpgradeImp ? 'd-flex' : 'd-none'
            }`}
          >
            <div data-id="proxy-dropdown-items">
              <Dropdown onToggle={toggleDropdown} show={showDropdown}>
                <Dropdown.Toggle
                  id="dropdown-custom-components"
                  as={ProxyAddressToggle}
                  address={proxyAddress}
                  onChange={handleAddressChange}
                  className="d-inline-block border border-dark bg-dark"
                />

                {props.proxy.deployments.length > 0 && (
                  <Dropdown.Menu
                    as={ProxyDropdownMenu}
                    className="w-100 custom-dropdown-items"
                    style={{overflow: 'hidden'}}
                  >
                    {props.proxy.deployments.map((deployment, index) => (
                      <CustomTooltip
                        placement={'right'}
                        tooltipClasses="text-nowrap"
                        tooltipId={`proxyAddressTooltip${index}`}
                        tooltipText={'Deployed ' + shortenDate(deployment.date)}
                        key={index}
                      >
                        <Dropdown.Item
                          key={index}
                          onClick={() => {
                            switchProxyAddress(deployment.address)
                          }}
                          data-id={`proxyAddress${index}`}
                        >
                          <span>
                            {proxyAddress === deployment.address ? (
                              <span>
                                &#10003;{' '}
                                {deployment.contractName +
                                  ' ' +
                                  shortenProxyAddress(deployment.address)}{' '}
                              </span>
                            ) : (
                              <span className="pl-3">
                                {deployment.contractName +
                                  ' ' +
                                  shortenProxyAddress(deployment.address)}
                              </span>
                            )}
                          </span>
                        </Dropdown.Item>
                      </CustomTooltip>
                    ))}
                  </Dropdown.Menu>
                )}
              </Dropdown>
            </div>
            <div className="d-flex">
              <div className="mb-2">
                {proxyAddressError && (
                  <span
                    className="text-lowercase text-danger"
                    data-id="errorMsgProxyAddress"
                    style={{fontSize: '.8em'}}
                  >
                    {proxyAddressError}
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
