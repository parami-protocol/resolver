const types = {
  Did: 'Vec<u8>',
  ExternalAddress: {
    btc: 'Vec<u8>',
    eth: 'Vec<u8>',
    eos: 'Vec<u8>'
  },
  LockedRecords: {
    locked_time: 'Moment',
    locked_period: 'Moment',
    locked_funds: 'Balance',
    rewards_ratio: 'u64',
    max_quota: 'u64'
  },
  UnlockedRecords: {
    unlocked_time: 'Moment',
    unlocked_funds: 'Balance'
  },
  MetadataRecord: {
    address: 'AccountId',
    superior: 'Hash',
    creator: 'AccountId',
    did: 'Did',
    locked_records: 'Option<LockedRecords<Balance, Moment>>',
    unlocked_records: 'Option<UnlockedRecords<Balance, Moment>>',
    social_account: 'Option<Hash>',
    subordinate_count: 'u64',
    group_name: 'Option<Vec<u8>>',
    external_address: 'ExternalAddress'
  },
  AdsMetadata: {
    advertiser: 'Vec<u8>',
    topic: 'Vec<u8>',
    total_amount: 'Balance',
    surplus: 'Balance',
    gas_fee_used: 'Balance',
    single_click_fee: 'Balance',
    create_time: 'Moment',
    period: 'Moment'
  },
  EventHTLC: {
    eth_contract_addr: 'Vec<u8>',
    htlc_block_number: 'BlockNumber',
    event_block_number: 'BlockNumber',
    expire_height: 'u32',
    random_number_hash: 'Vec<u8>',
    swap_id: 'Hash',
    event_timestamp: 'u64',
    htlc_timestamp: 'u64',
    sender_addr: 'Vec<u8>',
    sender_chain_type: 'HTLCChain',
    receiver_addr: 'AccountId',
    receiver_chain_type: 'HTLCChain',
    recipient_addr: 'Vec<u8>',
    out_amount: 'Balance'
  },
  HTLCChain: {
    _enum: ['ETHMain', 'PRA']
  },
  HTLCStates: {
    _enum: ['INVALID', 'OPEN', 'COMPLETED', 'EXPIRED']
  },
  EventLogSource: {
    event_name: 'Vec<u8>',
    event_url: 'Vec<u8>'
  }
}

export default types
