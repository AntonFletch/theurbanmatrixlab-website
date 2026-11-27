"use strict";
const addonHelpItems=[...document.querySelectorAll(".addon-help")];
addonHelpItems.forEach(item=>item.addEventListener("toggle",()=>{
  if(item.open)addonHelpItems.forEach(other=>{if(other!==item)other.open=false;});
}));
document.addEventListener("click",event=>{
  if(!event.target.closest(".addon-help"))addonHelpItems.forEach(item=>{item.open=false;});
});
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  const opened=addonHelpItems.find(item=>item.open);
  if(!opened)return;
  opened.open=false;
  opened.querySelector("summary")?.focus();
});
