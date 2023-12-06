import {initFhevm, createInstance, FhevmInstance} from 'fhevmjs/web'
import Web3 from 'web3'

export const init = async () => {
  await initFhevm()
}

let instance: {[key: string]: FhevmInstance}

export const createFhevmInstance = async (account: string, web3?: Web3) => {
  if (!web3) {
    instance = {}
    return
  }
  if (instance[account]) return instance[account]
  try {
    const chainId = await web3.eth.getChainId()
    const publicKey = await web3.eth.call({
      to: '0x000000000000000000000000000000000000005d',
      data: '0xd9d47bb001'
    })
    instance[account] = await createInstance({chainId, publicKey})
  } catch (e) {
    console.log('err', e)
  }
  return instance[account]
}

export const getInstance = (address: string) => {
  return instance[address]
}

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')

export const createEncrypt =
  (account: string) => (v: string | number, bits: number) => {
    const instance = getInstance(account)
    if (!instance) return `${v}`
    if (`${v}`.substring(0, 2) === '0x' || Number.isNaN(+v)) {
      return `${v}`
    }
    return `0x${toHexString(instance[`encrypt${bits}`](+v))}`
  }

export const createDecrypt =
  (account: string) => (contractAddress: string, ciphertext: string) => {
    const instance = getInstance(account)
    if (!instance) throw Error('No instance')
    return instance.decrypt(contractAddress, ciphertext)
  }

export const createGetContractToken =
  (account: string, web3?: Web3) =>
    async (
      contractAddress: string
    ): Promise<{signature: string; publicKey: string}> => {
      if (!web3) return
      const instance = getInstance(account)
      if (!instance) return
      if (instance.hasKeypair(contractAddress)) {
        const {signature, publicKey} =
        getInstance(account).getTokenSignature(contractAddress)!
        return {signature, publicKey: `0x${toHexString(publicKey)}`}
      } else {
        const {publicKey, token} = instance.generateToken({
          verifyingContract: contractAddress
        })
        const from = web3.givenProvider.selectedAddress
        console.log('params')
        const params = [from, JSON.stringify(token)]
        console.log('signature')
        return new Promise((resolve) => {
          web3.givenProvider.sendAsync(
            {
              method: 'eth_signTypedData_v4',
              params,
              from
            },
            (err, signatureObj) => {
              const signature = signatureObj.result
              console.log('lol', signatureObj)
              instance.setTokenSignature(contractAddress, signature)
              resolve({signature, publicKey: `0x${toHexString(publicKey)}`})
            }
          )
        })
      }
    }
