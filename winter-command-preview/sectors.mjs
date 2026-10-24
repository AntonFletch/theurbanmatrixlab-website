import { sectorNames, loadSectors } from './geography.mjs';
export async function sectorPicker({cards, select, previous, next, label, onSelect}) {
  const features=await loadSectors(); let page=0, selected=sectorNames[0];
  function render() {
    cards.replaceChildren(); previous.disabled=page===0; next.disabled=(page+1)*3>=sectorNames.length;
    label.textContent=(page*3+1)+'–'+Math.min(page*3+3,sectorNames.length)+' of '+sectorNames.length+' neighborhoods';
    for (const name of sectorNames.slice(page*3,page*3+3)) {
      const button=document.createElement('button'); button.type='button'; button.className='sector-card'; button.setAttribute('aria-pressed',String(name===selected));
      const number=document.createElement('span'); number.textContent=String(sectorNames.indexOf(name)+1).padStart(2,'0');
      const text=document.createElement('strong'); text.textContent=name; button.append(number,text); button.onclick=()=>choose(name); cards.append(button);
    }
    select.value=selected;
  }
  function choose(name) { selected=name; page=Math.floor(sectorNames.indexOf(name)/3); render(); onSelect(features.get(name)); }
  select.replaceChildren();
  sectorNames.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);});
  select.onchange=()=>choose(select.value); previous.onclick=()=>{page--;render();}; next.onclick=()=>{page++;render();};
  choose(selected);
  return {select:choose,current:()=>features.get(selected)};
}
