<script setup lang="ts">
import { computed, ref } from 'vue';
import { suggestChain } from '@leapwallet/cosmos-snap-provider';
import { useDashboard, type ChainConfig, useBlockchain, NetworkType } from '@/stores';
import { CosmosRestClient } from '@/libs/client';
import { onMounted } from 'vue';

const error = ref("")
const conf = ref("")
const evmConf = ref<string | null>(null)
const dashboard = useDashboard()
const selected = ref({} as ChainConfig)
const wallet = ref("leap")
const network = ref(NetworkType.Mainnet)
const mainnet = ref([] as ChainConfig[])
const testnet = ref([] as ChainConfig[])
const chains = computed(() => {
    return network.value === NetworkType.Mainnet ? mainnet.value : testnet.value
})

onMounted(() => {
    const chainStore = useBlockchain()
    selected.value = chainStore.current || Object.values(dashboard.chains)[0]
    initParamsForKeplr()

    dashboard.loadLocalConfig(NetworkType.Mainnet).then((res) => {
        mainnet.value = Object.values<ChainConfig>(res)
    })
    dashboard.loadLocalConfig(NetworkType.Testnet).then((res) => {
        testnet.value = Object.values<ChainConfig>(res)
    })
})

function onchange() {
    wallet.value === "metamask" ? initSnap() : initParamsForKeplr()
}

async function initParamsForKeplr() {
    const chain = selected.value
    if (!chain.endpoints?.rest?.at(0)) throw new Error("Endpoint does not set");
    const client = CosmosRestClient.newDefault(chain.endpoints.rest?.at(0)?.address || "")
    const b = await client.getBaseBlockLatest()
    const chainid = b.block.header.chain_id

    const gasPriceStep = chain.keplrPriceStep || {
        low: 0.01,
        average: 0.025,
        high: 0.03,
    }
    const coinDecimals = chain.assets[0].denom_units.find(x => x.denom === chain.assets[0].symbol.toLowerCase())?.exponent || 6
    conf.value = JSON.stringify({
        chainId: chainid,
        chainName: chain.chainName,
        rpc: chain.endpoints?.rpc?.at(0)?.address,
        rest: chain.endpoints?.rest?.at(0)?.address,
        bip44: {
            coinType: Number(chain.coinType),
        },
        coinType: Number(chain.coinType),
        bech32Config: {
            bech32PrefixAccAddr: chain.bech32Prefix,
            bech32PrefixAccPub: `${chain.bech32Prefix}pub`,
            bech32PrefixValAddr: `${chain.bech32Prefix}valoper`,
            bech32PrefixValPub: `${chain.bech32Prefix}valoperpub`,
            bech32PrefixConsAddr: `${chain.bech32Prefix}valcons`,
            bech32PrefixConsPub: `${chain.bech32Prefix}valconspub`,
        },
        currencies: [
            {
                coinDenom: chain.assets[0].symbol,
                coinMinimalDenom: chain.assets[0].base,
                coinDecimals,
                coinGeckoId: chain.assets[0].coingecko_id || 'unknown',
            },
        ],
        feeCurrencies: [
            {
                coinDenom: chain.assets[0].symbol,
                coinMinimalDenom: chain.assets[0].base,
                coinDecimals,
                coinGeckoId: chain.assets[0].coingecko_id || 'unknown',
                gasPriceStep,
            },
        ],
        gasPriceStep,
        stakeCurrency: {
            coinDenom: chain.assets[0].symbol,
            coinMinimalDenom: chain.assets[0].base,
            coinDecimals,
            coinGeckoId: chain.assets[0].coingecko_id || 'unknown',
        },
        features: chain.keplrFeatures || [],
    }, null, '\t')

  // Reference: https://docs.keplr.app/api/multi-ecosystem-support/evm
  if (chain.evm) {
    evmConf.value = JSON.stringify(chain.evm, null, '\t')
  }
}

async function initSnap() {
    const chain = selected.value
    const [token] = chain.assets

    if (!chain.endpoints?.rest?.at(0)) throw new Error("Endpoint does not set");
    const client = CosmosRestClient.newDefault(chain.endpoints.rest?.at(0)?.address || "")
    const b = await client.getBaseBlockLatest()
    const chainId = b.block.header.chain_id

    conf.value = JSON.stringify({
        chainId,
        chainName: chain.chainName,
        bech32Config: {
            bech32PrefixAccAddr: chain.bech32Prefix,
        },
        bip44: {
            coinType: Number(chain.coinType),
        },
        feeCurrencies: [
            {
                coinDenom: token.display,
                coinMinimalDenom: token.base,
                coinDecimals: token.denom_units.find(x => x.denom === token.display)?.exponent || 6,
                coinGeckoId: token.coingecko_id,
                gasPriceStep: {
                    low: 0.0625,
                    average: 0.5,
                    high: 62.5,
                },
            },
        ],
        features: chain.keplrFeatures || [],
    }, null, '\t')
}

function suggest() {
  if (wallet.value === "leap") {
    // @ts-ignore
    if (window.leap) {
      // @ts-ignore
      window.leap.experimentalSuggestChain(JSON.parse(conf.value)).catch(e => {
        error.value = e
      })

      // Reference: https://docs.keplr.app/api/multi-ecosystem-support/evm#example-usage
      if (evmConf.value !== null) {
        // @ts-ignore
        window.leap.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [JSON.parse(evmConf.value)]
        })// @ts-ignore
          .catch(e => {
          error.value = e
          console.log(e);
        })
      }
    }
  } else if (wallet.value === "keplr") {
    // One click suggest 2 chains
    // @ts-ignore
    if (window.keplr) {
      // @ts-ignore
      window.keplr.experimentalSuggestChain(JSON.parse(conf.value)).catch(e => {
        error.value = e
      })

      // Reference: https://docs.keplr.app/api/multi-ecosystem-support/evm#example-usage
      if (evmConf.value !== null) {
        // @ts-ignore
        window.keplr.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [JSON.parse(evmConf.value)]
        })// @ts-ignore
          .catch(e => {
          error.value = e
          console.log(e);
        })
      }
    }
    } else {
        suggestChain(JSON.parse(conf.value));
    }
}
</script>

<template>
    <div class="bg-base-100 p-4 rounded text-center">
        <div class="flex text-center">
            <select v-model="network" class="select select-bordered">
                <option :value="NetworkType.Mainnet">Mainnet</option>
                <option :value="NetworkType.Testnet">Testnet</option>
            </select>
            <select v-model="selected" class="select select-bordered mx-5" @change="onchange">
                <option v-for="c in chains" :value="c">
                    {{ c.chainName }}
                </option>
            </select>
          <label>
            <input type="radio" v-model="wallet" value="leap" class="radio radio-bordered ml-4" @change="onchange" />
            Leap
          </label>
            <label>
              <input type="radio" v-model="wallet" value="keplr" class="radio radio-bordered ml-4" @change="onchange" />
              Keplr
            </label>
            <label>
              <input type="radio" v-model="wallet" value="metamask" class="radio radio-bordered ml-4" @change="onchange"/>
              Metamask
            </label>
        </div>
        <div class="text-main mt-5">
            <textarea v-model="conf" class="textarea textarea-bordered w-full" rows="15"></textarea>
          <div v-if="evmConf !== null">
            <hr />
            <textarea v-model="evmConf" class="textarea textarea-bordered w-full" rows="15"></textarea>
          </div>
        </div>
        <div class="mt-4 mb-4">

            <button class="btn !bg-primary !border-primary text-white mr-2" @click="suggest">
              Suggest {{selected.chainName }} TO {{ wallet }}</button>

            <div class="mt-4">
                If the chain is not officially support on Keplr/Metamask Snap, you can submit these parameters to enable
                Keplr/Metamask Snap.
            </div>
        </div>

    </div>
</template>
