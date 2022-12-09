import { ethers } from 'hardhat';

export const parseLogs = ({ logs }, abi) => {
  const iface = new ethers.utils.Interface(abi);
  return (logs.map((log) => {
    try { return iface.parseLog(log); }
    catch {}
  })).filter((l) => l);
};

export const parseLogsNested = ({ logs }, abi, nestedAbi) => {
  const iface = new ethers.utils.Interface(abi);
  const ifaceNested = new ethers.utils.Interface(nestedAbi);
  return (logs.map((log) => {
    try { return iface.parseLog(log); }
    catch {
      try { return ifaceNested.parseLog(log); }
      catch {}
    }
  })).filter((l) => l);
};
