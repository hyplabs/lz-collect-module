import { Log, TransactionEvent } from '@tenderly/actions'
import { utils } from 'ethers';

export const findLog = (txEvent: TransactionEvent, targetAddress: string, targetAbi: any, _name: string) => {
  const logs = txEvent.logs.filter(({ address }) => targetAddress.toLowerCase() === address.toLowerCase());
  if (!logs.length) throw Error('log for target address not found');

  const parsed = logs.map((log) => parseLog(log, targetAbi));
  console.log(parsed);

  const log = parsed.find(({ name }) => name === _name);
  if (!log) throw Error('log not found');

  return log;
};

export const parseLog = (log: Log, targetAbi: any) => {
  const iface = new utils.Interface(targetAbi);
  return iface.parseLog(log);
};
