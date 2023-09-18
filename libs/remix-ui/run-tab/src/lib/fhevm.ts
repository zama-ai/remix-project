import {initFhevm, createInstance, FhevmInstance} from 'fhevmjs/web'
import Web3 from 'web3'

const fhevm = (window as any).fhevm
const ethereum = (window as any).ethereum

export const init = async () => {
  await initFhevm()
}

let instance: FhevmInstance

export const createFhevmInstance = async (web3?: Web3) => {
  if (!web3) return
  try {
    const chainId = await web3.eth.getChainId()
    const publicKey = await web3.eth.call({
      to: '0x0000000000000000000000000000000000000044'
    })
    instance = await createInstance({chainId, publicKey})
  } catch (e) {
    console.log('err', e)
    instance = undefined
  }
}

export const getTokenSignature = async (
  contractAddress: string,
  userAddress: string
) => {
  if (getInstance().hasKeypair(contractAddress)) {
    return getInstance().getTokenSignature(contractAddress)!
  } else {
    const {publicKey, token} = getInstance().generateToken({
      verifyingContract: contractAddress
    })
    const params = [userAddress, JSON.stringify(token)]
    const signature: string = await (window as any).ethereum.request({
      method: 'eth_signTypedData_v4',
      params
    })
    getInstance().setTokenSignature(contractAddress, signature)
    return {signature, publicKey}
  }
}

export const getInstance = () => {
  return instance
}
