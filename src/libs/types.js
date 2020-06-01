export default {
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
    donate: 'Option<Balance>',
    social_account: 'Option<Hash>',
    subordinate_count: 'u64',
    group_name: 'Option<Vec<u8>>',
    external_address: 'ExternalAddress'
  },
  AdsLinkedItem: {
    prev: 'Option<AdIndex>',
    next: 'Option<AdIndex>'
  },
  ActiveIndex: 'u64',
  AdIndex: 'u64',
  AdsMetadata: {
    advertiser: 'Vec<u8>',
    topic: 'Vec<u8>',
    total_amount: 'Balance',
    spend_amount: 'Balance',
    single_click_fee: 'Balance',
    display_page: 'Vec<u8>',
    landing_page: 'Option<Vec<u8>>',
    create_time: 'Moment',
    active: 'Option<ActiveIndex>'
  },
  EventHTLC: {
    eth_contract_addr: 'Vec<u8>',
    htlc_block_number: 'BlockNumber',
    event_block_number: 'BlockNumber',
    expire_height: 'u32',
    random_number_hash: 'Vec<u8>',
    swap_id: 'Hash',
    sender_addr: 'Vec<u8>',
    sender_chain_type: 'HTLCChain',
    receiver_addr: 'Hash',
    receiver_chain_type: 'HTLCChain',
    recipient_addr: 'Vec<u8>',
    out_amount: 'Balance',
    event_type: 'HTLCType'
  },
  HTLCChain: {
    _enum: [
      'ETHMain',
      'PRM'
    ]
  },
  HTLCStates: {
    _enum: [
      'INVALID',
      'OPEN',
      'COMPLETED',
      'EXPIRED'
    ]
  },
  EventLogSource: {
    event_name: 'Vec<u8>',
    event_url: 'Vec<u8>',
    event_data: 'Vec<u8>'
  },
  HTLCType: {
    _enum: [
      'HTLC',
      'Claimed',
      'Refunded'
    ]
  }
}
