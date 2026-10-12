// Known read commands may queue; every other command needs explicit real-time confirmation.
export function validateCommand(input){
  if(typeof input!=='string'||!input.trim()||input.length>240||/[^\x20-\x7e]/.test(input))throw new Error('Enter one ASCII command, up to 240 characters, without line breaks.');
  const text=input.trim(),normalized=text.replace(/ +/g,' ').toLowerCase();
  if(/^(getinfo|getstatus|getver|getgps|getio|ggps|lvcangetinfo|lvcangetprog|lvcancheck|lvcanfaultcodes)$/.test(normalized)||/^getparam [0-9]{1,6}(?:\s*;\s*[0-9]{1,6}){0,29}$/.test(normalized)||/^readio [0-9]{1,6}$/.test(normalized))return {kind:'read',text:normalized.replace(/\s*;\s*/g,';')};
  // Normalize only the established numeric setparam syntax. Arbitrary arguments
  // (APNs, passwords, URLs, etc.) retain their original case and internal spaces.
  if(/^setparam [0-9]{1,6}:[+-]?[0-9]{1,12}(?:\s*;\s*[0-9]{1,6}:[+-]?[0-9]{1,12}){0,15}$/.test(normalized))return {kind:'write',text:normalized.replace(/\s*;\s*/g,';')};
  return {kind:'write',text};
}
export function isReadCommand(input){try{return validateCommand(input).kind==='read';}catch{return false;}}
