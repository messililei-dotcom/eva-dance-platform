// Explicit student-facing API allowlist. No arbitrary forwarding or admin route access.
type Entry = { pattern: RegExp; methods: string[]; public: boolean; load: () => Promise<unknown> };
const routes: Entry[] = [
  {pattern:/^public\/series$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/series/route")},
  {pattern:/^public\/series\/([1-9]\d*)$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/series/[id]/route")},
  {pattern:/^public\/series\/([1-9]\d*)\/courses$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/series/[id]/courses/route")},
  {pattern:/^public\/series\/([1-9]\d*)\/detail$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/series/[id]/detail/route")},
  {pattern:/^public\/series\/([1-9]\d*)\/progress$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/public/series/[id]/progress/route")},
  {pattern:/^public\/offline-courses$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/offline-courses/route")},
  {pattern:/^public\/calendar$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/calendar/route")},
  {pattern:/^public\/home-stats$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/public/home-stats/route")},
  {pattern:/^events$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/events/route")},
  {pattern:/^events\/([1-9]\d*)$/,methods:["GET"],public:true,load:()=>import("@/app/api/mini/events/[id]/route")},
  {pattern:/^events\/([1-9]\d*)\/register$/,methods:["GET", "POST"],public:false,load:()=>import("@/app/api/mini/events/[id]/register/route")},
  {pattern:/^member\/profile$/,methods:["GET", "PUT"],public:false,load:()=>import("@/app/api/mini/member/profile/route")},
  {pattern:/^member\/authorized-series$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/authorized-series/route")},
  {pattern:/^member\/recent-courses$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/recent-courses/route")},
  {pattern:/^member\/growth$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/growth/route")},
  {pattern:/^member\/checkins$/,methods:["GET", "POST"],public:false,load:()=>import("@/app/api/mini/member/checkins/route")},
  {pattern:/^member\/payments$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/payments/route")},
  {pattern:/^member\/consume-records$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/consume-records/route")},
  {pattern:/^member\/events$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/events/route")},
  {pattern:/^member\/messages$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/messages/route")},
  {pattern:/^member\/messages\/unread-count$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/member/messages/unread-count/route")},
  {pattern:/^member\/messages\/read-all$/,methods:["POST"],public:false,load:()=>import("@/app/api/mini/member/messages/read-all/route")},
  {pattern:/^member\/messages\/([1-9]\d*)\/read$/,methods:["PATCH"],public:false,load:()=>import("@/app/api/mini/member/messages/[id]/read/route")},
  {pattern:/^certificates$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/certificates/route")},
  {pattern:/^video\/([1-9]\d*)\/play$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/video/[id]/play/route")},
  {pattern:/^video\/([1-9]\d*)\/progress$/,methods:["GET", "POST"],public:false,load:()=>import("@/app/api/mini/video/[id]/progress/route")},
  {pattern:/^notes$/,methods:["GET", "POST"],public:false,load:()=>import("@/app/api/mini/notes/route")},
  {pattern:/^notes\/all$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/notes/all/route")},
  {pattern:/^notes\/([1-9]\d*)$/,methods:["DELETE"],public:false,load:()=>import("@/app/api/mini/notes/[id]/route")},
  {pattern:/^bookmarks$/,methods:["GET", "POST"],public:false,load:()=>import("@/app/api/mini/bookmarks/route")},
  {pattern:/^bookmarks\/all$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/bookmarks/all/route")},
  {pattern:/^bookmarks\/([1-9]\d*)$/,methods:["DELETE"],public:false,load:()=>import("@/app/api/mini/bookmarks/[id]/route")},
  {pattern:/^offline\/overview$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/offline/overview/route")},
  {pattern:/^offline\/bookings$/,methods:["POST"],public:false,load:()=>import("@/app/api/mini/offline/bookings/route")},
  {pattern:/^offline\/bookings\/([1-9]\d*)$/,methods:["PATCH"],public:false,load:()=>import("@/app/api/mini/offline/bookings/[id]/route")},
  {pattern:/^offline\/checkin$/,methods:["POST"],public:false,load:()=>import("@/app/api/mini/offline/checkin/route")},
  {pattern:/^checkins$/,methods:["POST"],public:false,load:()=>import("@/app/api/mini/checkins/route")},
  {pattern:/^checkins\/my$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/checkins/my/route")},
  {pattern:/^checkins\/series\/([1-9]\d*)$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/checkins/series/[id]/route")},
  {pattern:/^activity\/series\/([1-9]\d*)$/,methods:["GET"],public:false,load:()=>import("@/app/api/mini/activity/series/[id]/route")},
];
export function findAppRoute(path: string, method: string) {
  for (const entry of routes) {
    const match = path.match(entry.pattern);
    if (match && entry.methods.includes(method)) return {...entry, public:entry.public && method === "GET", params:match[1] ? {id:match[1]} : {}};
  }
  return null;
}
