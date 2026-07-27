function getSeatMapByBus(tipo){

if(tipo.includes('PB'))
return 'irizar-pb-63';

if(tipo.includes('Century'))
return 'irizar-century-53';

if(tipo.includes('Limousine'))
return 'limousine-30';

return null;

}
