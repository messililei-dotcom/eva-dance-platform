const api=require('../../utils/api');
const share=require('../../shared/share');
const view=require('../../shared/event-view');
Page(share.withShare('event-player', {
 data:{competitionId:'',groupId:'',playerId:'',competition:{},group:{},player:{},judgeScores:[],loading:true,error:''},
 onLoad(options){this.setData({competitionId:options.id,groupId:options.groupId,playerId:options.playerId});this.reload();},
 onPullDownRefresh(){return this.reload().finally(()=>wx.stopPullDownRefresh());},
 async reload(){this.setData({loading:true,error:''});try{const d=await api.getEventPlayerDetail(this.data.competitionId,this.data.groupId,this.data.playerId);this.setData({...d,player:view.player(d.player),judgeScores:(d.judgeScores||[]).map(j=>({...j,initial:String(j.name||'评').slice(0,1),scoreText:j.score==null?'未公开':view.score(j.score)}))});wx.setNavigationBarTitle({title:d.player.name+' · 参赛详情'});}catch(e){this.setData({error:e.message||'参赛详情加载失败'});}finally{this.setData({loading:false});}},
 openGroup(){wx.navigateTo({url:`/pages/event-group/event-group?id=${this.data.competitionId}&groupId=${this.data.groupId}`});}
}));
