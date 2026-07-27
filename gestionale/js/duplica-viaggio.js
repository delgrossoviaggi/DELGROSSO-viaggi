async function duplicaViaggio(id){

const {data}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',id)
.single();

if(!data) return;

delete data.id;

await supabaseClient
.from('viaggi')
.insert([data]);

alert('Viaggio duplicato');

}
