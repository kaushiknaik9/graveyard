export function haversineDistance(lat1:number,lon1:number,lat2:number,lon2:number):number{
  const toRad=(d:number)=>(d*Math.PI)/180;
  const R=6371; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export const WARDS=[{name:'North Ward',lat:12.9716,lng:77.5946},{name:'South Ward',lat:12.9350,lng:77.6100},{name:'East Ward',lat:12.9650,lng:77.6400},{name:'West Ward',lat:12.9550,lng:77.5600},{name:'Central Ward',lat:12.9580,lng:77.6030}];
