fetch('https://bugukfvhxtlnyftolvtx.supabase.co/rest/v1/', {
  headers: {
    apikey: 'sb_secret_ExwGvMs2Z4CDaIHXW90iJw_KrZBoxy1',
    Authorization: 'Bearer sb_secret_ExwGvMs2Z4CDaIHXW90iJw_KrZBoxy1'
  }
}).then(async r => {
  console.log("STATUS:", r.status);
  console.log("BODY:", await r.text());
}).catch(console.error);
