import {env} from 'cloudflare:workers';
export const database=()=>{if(!env.DB)throw Error('Storage unavailable');return env.DB;};
