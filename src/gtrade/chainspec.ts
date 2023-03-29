import { ChainSpec } from ".";

// Gains pairs with pairIndices: https://gains-network.gitbook.io/docs-home/gtrade-leveraged-trading/pair-list

export const POLYGON_SPEC: ChainSpec = {
  id: "polygon",
  daiAddress: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  storageAddress: "0xaee4d11a16B2bc65EDD6416Fb626EB404a6D65BD",
  rpcUrl: "wss://polygon.llamarpc.com",
  // polygon chainlink contracts: https://data.chain.link/polygon/mainnet/crypto-usd
  pairs: [
    { index: 0, pair: "btc", aggregatorProxyAddress: "0xc907e116054ad103354f2d350fd2514433d57f6f" },
    { index: 1, pair: "eth", aggregatorProxyAddress: "0xab594600376ec9fd91f8e885dadf0ce036862de0" },
    { index: 2, pair: "link", aggregatorProxyAddress: "0xd9ffdb71ebe7496cc440152d43986aae0ab76665" },
    { index: 3, pair: "doge", aggregatorProxyAddress: "0xbaf9327b6564454f4a3364c33efeef032b4b4444" },
    { index: 4, pair: "matic", aggregatorProxyAddress: "0xab594600376ec9fd91f8e885dadf0ce036862de0" },
    { index: 5, pair: "ada", aggregatorProxyAddress: "0x882554df528115a743c4537828da8d5b58e52544" },
    { index: 6, pair: "sushi", aggregatorProxyAddress: "0x49b0c695039243bbfeb8ecd054eb70061fd54aa0" },
    // { index: 7, pair: "aave", aggregatorProxyAddress: "xxx" },
    { index: 8, pair: "algo", aggregatorProxyAddress: "0x03bc6d9efed65708d35fdaefb25e87631a0a3437" },
    { index: 9, pair: "bat", aggregatorProxyAddress: "0x2346ce62bd732c62618944e51cbfa09d985d86d2" },
    { index: 10, pair: "comp", aggregatorProxyAddress: "0x2a8758b7257102461bc958279054e372c2b1bde6" },
    { index: 11, pair: "dot", aggregatorProxyAddress: "0xacb51f1a83922632ca02b25a8164c10748001bde" },
    { index: 12, pair: "eos", aggregatorProxyAddress: "0xd6285f06203d938ab713fa6a315e7d23247dde95" },
    { index: 13, pair: "ltc", aggregatorProxyAddress: "0xeb99f173cf7d9a6dc4d889c2ad7103e8383b6efa" },
    { index: 14, pair: "mana", aggregatorProxyAddress: "0xa1cbf3fe43bc3501e3fc4b573e822c70e76a7512" },
    { index: 15, pair: "omg", aggregatorProxyAddress: "0x93ffee768f74208a7b9f2a4426f0f6bcbb1d09de" },
    { index: 16, pair: "snx", aggregatorProxyAddress: "0xbf90a5d9b6ee9019028dbfc2a9e50056d5252894" },
    // { index: 17, pair: "uni", aggregatorProxyAddress: "xxx" },
    { index: 18, pair: "xlm", aggregatorProxyAddress: "0x692ae5510ca9070095a496dbcfbcda99d4024cd9" },
    { index: 19, pair: "xrp", aggregatorProxyAddress: "0x785ba89291f676b5386652eb12b30cf361020694" },
    { index: 20, pair: "zec", aggregatorProxyAddress: "0xbc08c639e579a391c4228f20d0c29d0690092df0" },
    { index: 21, pair: "audusd", aggregatorProxyAddress: "0x062df9c4efd2030e243ffcc398b652e8b8f95c6f" },
    // { index: 22, pair: "eurchf", aggregatorProxyAddress: "xxx" },
    // { index: 23, pair: "eurgbp", aggregatorProxyAddress: "xxx" },
    // { index: 24, pair: "eurjpy", aggregatorProxyAddress: "xxx" },
    { index: 25, pair: "eurusd", aggregatorProxyAddress: "0x73366fe0aa0ded304479862808e02506fe556a98" },
    { index: 26, pair: "gbpusd", aggregatorProxyAddress: "0x099a2540848573e94fb1ca0fa420b00acbbc845a" },
    // { index: 27, pair: "nzdusd", aggregatorProxyAddress: "xxx" },
    // { index: 28, pair: "usdcad", aggregatorProxyAddress: "xxx" },
    // { index: 29, pair: "usdchf", aggregatorProxyAddress: "xxx" },
    // { index: 30, pair: "usdjpy", aggregatorProxyAddress: "xxx" },
    // { index: 31, pair: "luna", aggregatorProxyAddress: "xxx" },
    { index: 32, pair: "yfi", aggregatorProxyAddress: "0x9d3a43c111e7b2c6601705d9fcf7a70c95b1dc55" },
    { index: 33, pair: "sol", aggregatorProxyAddress: "0x10c8264c0935b3b9870013e057f330ff3e9c56dc" },
    // { index: 34, pair: "xtz", aggregatorProxyAddress: "xxx" },
    { index: 35, pair: "bch", aggregatorProxyAddress: "0x327d9822e9932996f55b39f557aec838313da8b7" },
    { index: 36, pair: "bnt", aggregatorProxyAddress: "0xf5724884b6e99257cc003375e6b844bc776183f9" },
    // { index: 37, pair: "crv", aggregatorProxyAddress: "xxx" },
    { index: 38, pair: "dash", aggregatorProxyAddress: "0xd94427edee70e4991b4b8ddcc848f2b58ed01c0b" },
    { index: 39, pair: "etc", aggregatorProxyAddress: "0xdf3f72be10d194b58b1bb56f2c4183e661cb2114" },
    { index: 40, pair: "icp", aggregatorProxyAddress: "0x84227a76a04289473057bef706646199d7c58c34" },
    { index: 41, pair: "mkr", aggregatorProxyAddress: "0xa070427bf5ba5709f70e98b94cb2f435a242c46c" },
    { index: 42, pair: "neo", aggregatorProxyAddress: "0x74b3587a23ee786a43c8529c2e98d3c05a8fb1fb" },
    { index: 43, pair: "theta", aggregatorProxyAddress: "0x38611b09f8f2d520c14ea973765c225bf57b9eac" },
    { index: 44, pair: "trx", aggregatorProxyAddress: "0x307ccf7cbd17b69a487b9c3dbe483931cf3e1833" },
    { index: 45, pair: "zrx", aggregatorProxyAddress: "0x6ea4d89474d9410939d429b786208c74853a5b47" },
    { index: 46, pair: "sand", aggregatorProxyAddress: "0x3d49406edd4d52fb7ffd25485f32e073b529c924" },
    { index: 47, pair: "bnb", aggregatorProxyAddress: "0x82a6c4af830caa6c97bb504425f6a66165c2c26e" },
    // { index: 48, pair: "axs", aggregatorProxyAddress: "xxx" },
    // { index: 49, pair: "grt", aggregatorProxyAddress: "xxx" },
    // { index: 50, pair: "hbar", aggregatorProxyAddress: "xxx" },
    // { index: 51, pair: "xmr", aggregatorProxyAddress: "xxx" },
    // { index: 52, pair: "enj", aggregatorProxyAddress: "xxx" },
    { index: 53, pair: "ftm", aggregatorProxyAddress: "0x58326c0f831b2dbf7234a4204f28bba79aa06d5f" },
    // { index: 54, pair: "ftt", aggregatorProxyAddress: "xxx" },
    { index: 55, pair: "ape", aggregatorProxyAddress: "0x2ac3f3bfac8fc9094bc3f0f9041a51375235b992" },
    // { index: 56, pair: "chz", aggregatorProxyAddress: "xxx" },
    // { index: 57, pair: "shib", aggregatorProxyAddress: "xxx" },
    // ...
    { index: 102, pair: "avax", aggregatorProxyAddress: "0xe01ea2fbd8d76ee323fbed03eb9a8625ec981a10" },
    // { index: 103, pair: "atom", aggregatorProxyAddress: "xxx" },
    // { index: 104, pair: "near", aggregatorProxyAddress: "xxx" },
    // { index: 105, pair: "qnt", aggregatorProxyAddress: "xxx" },
    // { index: 106, pair: "iota", aggregatorProxyAddress: "xxx" },
    // { index: 107, pair: "ton", aggregatorProxyAddress: "xxx" },
    // { index: 108, pair: "rpl", aggregatorProxyAddress: "xxx" },
  ],
};

export const ARBITRUM_SPEC: ChainSpec = {
  id: "arbitrum",
  daiAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  storageAddress: "0xcFa6ebD475d89dB04cAd5A756fff1cb2BC5bE33c",
  rpcUrl: "wss://arb-mainnet.g.alchemy.com/v2/BnencMGjoPsmbRIjrDZvh4zLTmlZyDtG",
  // arbitrum chainlink contracts: https://data.chain.link/arbitrum/mainnet/crypto-usd
  pairs: [
    { index: 0, pair: "btc", aggregatorProxyAddress: "0x6ce185860a4963106506c203335a2910413708e9" },
    { index: 1, pair: "eth", aggregatorProxyAddress: "0x639fe6ab55c921f74e7fac1ee960c0b6293ba612" },
    { index: 2, pair: "link", aggregatorProxyAddress: "0x86e53cf1b870786351da77a57575e79cb55812cb" },
    { index: 3, pair: "doge", aggregatorProxyAddress: "0x9a7fb1b3950837a8d9b40517626e11d4127c098c" },
    { index: 4, pair: "matic", aggregatorProxyAddress: "0x52099d4523531f678dfc568a7b1e5038aadce1d6" },
    { index: 5, pair: "ada", aggregatorProxyAddress: "0xd9f615a9b820225edba2d821c4a696a0924051c6" },
    { index: 6, pair: "sushi", aggregatorProxyAddress: "0xb2a8ba74cbca38508ba1632761b56c897060147c" },
    { index: 7, pair: "aave", aggregatorProxyAddress: "0xad1d5344aade45f43e596773bcc4c423eabdd034" },
    // { index: 8, pair: "algo", aggregatorProxyAddress: "xxx" },
    // { index: 9, pair: "bat", aggregatorProxyAddress: "xxx" },
    { index: 10, pair: "comp", aggregatorProxyAddress: "0xe7c53ffd03eb6cef7d208bc4c13446c76d1e5884" },
    { index: 11, pair: "dot", aggregatorProxyAddress: "0xa6bc5baf2000424e90434ba7104ee399dee80dec" },
    // { index: 12, pair: "eos", aggregatorProxyAddress: "xxx" },
    // { index: 13, pair: "ltc", aggregatorProxyAddress: "xxx" },
    // { index: 14, pair: "mana", aggregatorProxyAddress: "xxx" },
    // { index: 15, pair: "omg", aggregatorProxyAddress: "xxx" },
    // { index: 16, pair: "snx", aggregatorProxyAddress: "xxx" },
    { index: 17, pair: "uni", aggregatorProxyAddress: "0x9c917083fdb403ab5adbec26ee294f6ecada2720" },
    // { index: 18, pair: "xlm", aggregatorProxyAddress: "xxx" },
    { index: 19, pair: "xrp", aggregatorProxyAddress: "0xb4ad57b52ab9141de9926a3e0c8dc6264c2ef205" },
    // { index: 20, pair: "zec", aggregatorProxyAddress: "xxx" },
    { index: 21, pair: "audusd", aggregatorProxyAddress: "0x9854e9a850e7c354c1de177ea953a6b1fba8fc22" },
    // { index: 22, pair: "eurchf", aggregatorProxyAddress: "xxx" },
    // { index: 23, pair: "eurgbp", aggregatorProxyAddress: "xxx" },
    // { index: 24, pair: "eurjpy", aggregatorProxyAddress: "xxx" },
    { index: 25, pair: "eurusd", aggregatorProxyAddress: "0xa14d53bc1f1c0f31b4aa3bd109344e5009051a84" },
    { index: 26, pair: "gbpusd", aggregatorProxyAddress: "0x9c4424fd84c6661f97d8d6b3fc3c1aac2bedd137" },
    // { index: 27, pair: "nzdusd", aggregatorProxyAddress: "xxx" },
    // { index: 28, pair: "usdcad", aggregatorProxyAddress: "xxx" },
    // { index: 29, pair: "usdchf", aggregatorProxyAddress: "xxx" },
    // { index: 30, pair: "usdjpy", aggregatorProxyAddress: "xxx" },
    // { index: 31, pair: "luna", aggregatorProxyAddress: "xxx" },
    { index: 32, pair: "yfi", aggregatorProxyAddress: "0x745ab5b69e01e2be1104ca84937bb71f96f5fb21" },
    { index: 33, pair: "sol", aggregatorProxyAddress: "0x24cea4b8ce57cda5058b924b9b9987992450590c" },
    // { index: 34, pair: "xtz", aggregatorProxyAddress: "xxx" },
    // { index: 35, pair: "bch", aggregatorProxyAddress: "xxx" },
    // { index: 36, pair: "bnt", aggregatorProxyAddress: "xxx" },
    { index: 37, pair: "crv", aggregatorProxyAddress: "0xaebda2c976cfd1ee1977eac079b4382acb849325" },
    // { index: 38, pair: "dash", aggregatorProxyAddress: "xxx" },
    // { index: 39, pair: "etc", aggregatorProxyAddress: "xxx" },
    // { index: 40, pair: "icp", aggregatorProxyAddress: "xxx" },
    { index: 41, pair: "mkr", aggregatorProxyAddress: "0xde9f0894670c4efcacf370426f10c3ad2cdf147e" },
    // { index: 42, pair: "neo", aggregatorProxyAddress: "xxx" },
    // { index: 43, pair: "theta", aggregatorProxyAddress: "xxx" },
    // { index: 44, pair: "trx", aggregatorProxyAddress: "xxx" },
    // { index: 45, pair: "zrx", aggregatorProxyAddress: "xxx" },
    // { index: 46, pair: "sand", aggregatorProxyAddress: "xxx" },
    // { index: 47, pair: "bnb", aggregatorProxyAddress: "xxx" },
    // { index: 48, pair: "axs", aggregatorProxyAddress: "xxx" },
    // { index: 49, pair: "grt", aggregatorProxyAddress: "xxx" },
    // { index: 50, pair: "hbar", aggregatorProxyAddress: "xxx" },
    // { index: 51, pair: "xmr", aggregatorProxyAddress: "xxx" },
    // { index: 52, pair: "enj", aggregatorProxyAddress: "xxx" },
    // { index: 53, pair: "ftm", aggregatorProxyAddress: "xxx" },
    // { index: 54, pair: "ftt", aggregatorProxyAddress: "xxx" },
    { index: 55, pair: "ape", aggregatorProxyAddress: "0x221912ce795669f628c51c69b7d0873eda9c03bb" },
    // { index: 56, pair: "chz", aggregatorProxyAddress: "xxx" },
    // { index: 57, pair: "shib", aggregatorProxyAddress: "xxx" },
    // ...
    // { index: 102, pair: "avax", aggregatorProxyAddress: "xxx" },
    { index: 103, pair: "atom", aggregatorProxyAddress: "0xcda67618e51762235eaca373894f0c79256768fa" },
    { index: 104, pair: "near", aggregatorProxyAddress: "0xbf5c3fb2633e924598a46b9d07a174a9dbcf57c0" },
    // { index: 105, pair: "qnt", aggregatorProxyAddress: "xxx" },
    // { index: 106, pair: "iota", aggregatorProxyAddress: "xxx" },
    // { index: 107, pair: "ton", aggregatorProxyAddress: "xxx" },
    // { index: 108, pair: "rpl", aggregatorProxyAddress: "xxx" },
  ],
};

export const MUMBAI_SPEC: ChainSpec = {
  id: "mumbai",
  daiAddress: "0x04b2a6e51272c82932ecab31a5ab5ac32ae168c3",
  storageAddress: "0x4d2df485c608aa55a23d8d98dd2b4fa24ba0f2cf",
  rpcUrl: "wss://polygon-mumbai.g.alchemy.com/v2/US6ybgcQC9-FpHhr0TOiBN35NKYH18r5",
  pairs: [
    { index: 0, pair: "btc", aggregatorProxyAddress: "0x11e187fd2c832a95bdd78a46dda774d5821e7569" },
    { index: 1, pair: "eth", aggregatorProxyAddress: "0xb4ccb58dd3d35530e54b631ac0561f0c6d424d38" },
    { index: 2, pair: "link", aggregatorProxyAddress: "0x1C2252aeeD50e0c9B64bDfF2735Ee3C932F5C408" },
    // { index: 3, pair: "doge", aggregatorProxyAddress: "xxx" },
    { index: 4, pair: "matic", aggregatorProxyAddress: "0x10609FE0acE16179c826b1c8A16aa34c3611faf7" },
    // { index: 5, pair: "ada", aggregatorProxyAddress: "xxx" },
    // { index: 6, pair: "sushi", aggregatorProxyAddress: "xxx" },
    // { index: 7, pair: "aave", aggregatorProxyAddress: "xxx" },
    // { index: 8, pair: "algo", aggregatorProxyAddress: "xxx" },
    // { index: 9, pair: "bat", aggregatorProxyAddress: "xxx" },
    // { index: 10, pair: "comp", aggregatorProxyAddress: "xxx" },
    // { index: 11, pair: "dot", aggregatorProxyAddress: "xxx" },
    // { index: 12, pair: "eos", aggregatorProxyAddress: "xxx" },
    // { index: 13, pair: "ltc", aggregatorProxyAddress: "xxx" },
    // { index: 14, pair: "mana", aggregatorProxyAddress: "xxx" },
    // { index: 15, pair: "omg", aggregatorProxyAddress: "xxx" },
    // { index: 16, pair: "snx", aggregatorProxyAddress: "xxx" },
    // { index: 17, pair: "uni", aggregatorProxyAddress: "xxx" },
    // { index: 18, pair: "xlm", aggregatorProxyAddress: "xxx" },
    // { index: 19, pair: "xrp", aggregatorProxyAddress: "xxx" },
    // { index: 20, pair: "zec", aggregatorProxyAddress: "xxx" },
    // { index: 21, pair: "audusd", aggregatorProxyAddress: "xxx" },
    // { index: 22, pair: "eurchf", aggregatorProxyAddress: "xxx" },
    // { index: 23, pair: "eurgbp", aggregatorProxyAddress: "xxx" },
    // { index: 24, pair: "eurjpy", aggregatorProxyAddress: "xxx" },
    { index: 25, pair: "eurusd", aggregatorProxyAddress: "0x83a72b915Ab7e9299ad0Ed1913A7e7AB0C88D209" },
    // { index: 26, pair: "gbpusd", aggregatorProxyAddress: "xxx" },
    // { index: 27, pair: "nzdusd", aggregatorProxyAddress: "xxx" },
    // { index: 28, pair: "usdcad", aggregatorProxyAddress: "xxx" },
    // { index: 29, pair: "usdchf", aggregatorProxyAddress: "xxx" },
    // { index: 30, pair: "usdjpy", aggregatorProxyAddress: "xxx" },
    // { index: 31, pair: "luna", aggregatorProxyAddress: "xxx" },
    // { index: 32, pair: "yfi", aggregatorProxyAddress: "xxx" },
    // { index: 33, pair: "sol", aggregatorProxyAddress: "xxx" },
    // { index: 34, pair: "xtz", aggregatorProxyAddress: "xxx" },
    // { index: 35, pair: "bch", aggregatorProxyAddress: "xxx" },
    // { index: 36, pair: "bnt", aggregatorProxyAddress: "xxx" },
    // { index: 37, pair: "crv", aggregatorProxyAddress: "xxx" },
    // { index: 38, pair: "dash", aggregatorProxyAddress: "xxx" },
    // { index: 39, pair: "etc", aggregatorProxyAddress: "xxx" },
    // { index: 40, pair: "icp", aggregatorProxyAddress: "xxx" },
    // { index: 41, pair: "mkr", aggregatorProxyAddress: "xxx" },
    // { index: 42, pair: "neo", aggregatorProxyAddress: "xxx" },
    // { index: 43, pair: "theta", aggregatorProxyAddress: "xxx" },
    // { index: 44, pair: "trx", aggregatorProxyAddress: "xxx" },
    // { index: 45, pair: "zrx", aggregatorProxyAddress: "xxx" },
    // { index: 46, pair: "sand", aggregatorProxyAddress: "xxx" },
    // { index: 47, pair: "bnb", aggregatorProxyAddress: "xxx" },
    // { index: 48, pair: "axs", aggregatorProxyAddress: "xxx" },
    // { index: 49, pair: "grt", aggregatorProxyAddress: "xxx" },
    // { index: 50, pair: "hbar", aggregatorProxyAddress: "xxx" },
    // { index: 51, pair: "xmr", aggregatorProxyAddress: "xxx" },
    // { index: 52, pair: "enj", aggregatorProxyAddress: "xxx" },
    // { index: 53, pair: "ftm", aggregatorProxyAddress: "xxx" },
    // { index: 54, pair: "ftt", aggregatorProxyAddress: "xxx" },
    // { index: 55, pair: "ape", aggregatorProxyAddress: "xxx" },
    // { index: 56, pair: "chz", aggregatorProxyAddress: "xxx" },
    // { index: 57, pair: "shib", aggregatorProxyAddress: "xxx" },
    // // ...
    // { index: 102, pair: "avax", aggregatorProxyAddress: "xxx" },
    // { index: 103, pair: "atom", aggregatorProxyAddress: "xxx" },
    // { index: 104, pair: "near", aggregatorProxyAddress: "xxx" },
    // { index: 105, pair: "qnt", aggregatorProxyAddress: "xxx" },
    // { index: 106, pair: "iota", aggregatorProxyAddress: "xxx" },
    // { index: 107, pair: "ton", aggregatorProxyAddress: "xxx" },
    // { index: 108, pair: "rpl", aggregatorProxyAddress: "xxx" },
    // { index: 46, pair: "sand", aggregatorProxyAddress: "xxx" },
    // { index: 47, pair: "bnb", aggregatorProxyAddress: "xxx" },
    // { index: 48, pair: "axs", aggregatorProxyAddress: "xxx" },
    // { index: 49, pair: "grt", aggregatorProxyAddress: "xxx" },
    // { index: 50, pair: "hbar", aggregatorProxyAddress: "xxx" },
    // { index: 51, pair: "xmr", aggregatorProxyAddress: "xxx" },
    // { index: 52, pair: "enj", aggregatorProxyAddress: "xxx" },
    // { index: 53, pair: "ftm", aggregatorProxyAddress: "xxx" },
    // { index: 54, pair: "ftt", aggregatorProxyAddress: "xxx" },
    // { index: 55, pair: "ape", aggregatorProxyAddress: "xxx" },
    // { index: 56, pair: "chz", aggregatorProxyAddress: "xxx" },
    // { index: 57, pair: "shib", aggregatorProxyAddress: "xxx" },
    // // ...
    // { index: 102, pair: "avax", aggregatorProxyAddress: "xxx" },
    // { index: 103, pair: "atom", aggregatorProxyAddress: "xxx" },
    // { index: 104, pair: "near", aggregatorProxyAddress: "xxx" },
    // { index: 105, pair: "qnt", aggregatorProxyAddress: "xxx" },
    // { index: 106, pair: "iota", aggregatorProxyAddress: "xxx" },
    // { index: 107, pair: "ton", aggregatorProxyAddress: "xxx" },
    // { index: 108, pair: "rpl", aggregatorProxyAddress: "xxx" },
  ],
};

export function getChainSpec(id: "polygon" | "arbitrum" | "mumbai"): ChainSpec {
  const spec = [POLYGON_SPEC, ARBITRUM_SPEC, MUMBAI_SPEC].find((x) => x.id == id);
  if (!spec) throw new Error(`Invalid chain spec ${id}`);
  return spec;
}