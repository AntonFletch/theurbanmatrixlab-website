// Personal outreach history remains scoped to the signed-in authorized staff user.
export async function readFlags(client,userId,sector) {
  const flags=new Map();
  for(let offset=0;offset<100000;offset+=1000) {
    const {data,error}=await client.from('sector_property_statuses').select('property_id,sector,contacted,declined,excluded,active_business,vip,notes,updated_at').eq('sector',sector).eq('user_id',userId).order('property_id').range(offset,offset+999);
    if(error)throw error;
    for(const row of data||[])flags.set(row.property_id,row);
    if((data||[]).length<1000)return flags;
  }
  throw Error('Status history is too large to load completely');
}
export async function writeFlag(client,record,previous) {
  const table=client.from('sector_property_statuses');
  const request=previous?.updated_at
    ?table.update(record).eq('user_id',record.user_id).eq('property_id',record.property_id).eq('updated_at',previous.updated_at)
    :table.insert(record);
  const {data,error}=await request.select('property_id,sector,contacted,declined,excluded,active_business,vip,notes,updated_at').maybeSingle();
  if(error?.code==='23505'||(!error&&!data))throw Error('Another device changed this property. Reload its saved status before saving again.');
  if(error)throw error;
  return data;
}
