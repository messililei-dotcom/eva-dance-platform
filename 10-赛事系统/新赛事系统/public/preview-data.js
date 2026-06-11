window.LEGACY_DATA = {
  meta: {
    generatedAt: "2026-05-28T00:00:00",
    sourceFiles: ["preview"],
    tableCounts: {
      dfwq_competition: 4,
      dfwq_competition_scorerules: 8,
      dfwq_comps_user: 12,
      dfwq_group: 6,
      dfwq_groupjudges: 12,
      dfwq_integral: 0,
      dfwq_player: 18,
      dfwq_score: 128,
      sys_user: 3
    }
  },
  normalized: {
    competitions: [
      { id: 1, comps_name: "2025 AiwaRaks东方舞国际公开赛", startDate: "2025-06-28 00:00:00", endDate: "2025-06-30 00:00:00", comps_time: "2025-06-28 09:00:00", citys: "上海", signup: 1, sign_price: 299, comps_sysuser_id: 1, groupCount: 3, playerCount: 8, paidPlayerCount: 6, scoredPlayerCount: 5, judgeCount: 5, scoreRecordCount: 76, comps_posterPic: "", comps_defaultAvatar: "" },
      { id: 2, comps_name: "2025 华东区东方舞精英赛", startDate: "2025-08-10 00:00:00", endDate: "2025-08-12 00:00:00", comps_time: "2025-08-10 09:30:00", citys: "杭州", signup: 1, sign_price: 199, comps_sysuser_id: 1, groupCount: 2, playerCount: 5, paidPlayerCount: 4, scoredPlayerCount: 2, judgeCount: 4, scoreRecordCount: 32, comps_posterPic: "", comps_defaultAvatar: "" },
      { id: 3, comps_name: "2025 青少年东方舞大赛", startDate: "2025-10-01 00:00:00", endDate: "2025-10-03 00:00:00", comps_time: "2025-10-01 10:00:00", citys: "南京", signup: 0, sign_price: 0, comps_sysuser_id: 2, groupCount: 1, playerCount: 3, paidPlayerCount: 2, scoredPlayerCount: 0, judgeCount: 3, scoreRecordCount: 12, comps_posterPic: "", comps_defaultAvatar: "" },
      { id: 4, comps_name: "AiwaRaks国际东方舞艺术节", startDate: "2025-12-06 00:00:00", endDate: "2025-12-07 00:00:00", comps_time: "2025-12-06 08:00:00", citys: "沈阳", signup: 0, sign_price: 0, comps_sysuser_id: 3, groupCount: 0, playerCount: 2, paidPlayerCount: 1, scoredPlayerCount: 0, judgeCount: 0, scoreRecordCount: 8, comps_posterPic: "", comps_defaultAvatar: "" }
    ],
    groups: [
      { id: 101, comps_id: 1, group_name: "青年A组 · 个人赛", sort: 1, comps_time: "2025-06-28 10:00:00" },
      { id: 102, comps_id: 1, group_name: "成年组 · 职业个人A组", sort: 2, comps_time: "2025-06-28 14:00:00" },
      { id: 103, comps_id: 1, group_name: "团体赛", sort: 3, comps_time: "2025-06-29 10:00:00" },
      { id: 201, comps_id: 2, group_name: "青年组 · 个人赛", sort: 1, comps_time: "2025-08-10 10:00:00" },
      { id: 202, comps_id: 2, group_name: "公开组 · 团体赛", sort: 2, comps_time: "2025-08-11 10:00:00" },
      { id: 301, comps_id: 3, group_name: "少年A组 · 个人赛", sort: 1, comps_time: "2025-10-01 10:00:00" }
    ],
    users: [
      { id: 1, nickname: "评委A", tel: "138****0001", isJudges: 1, user_state: 1 },
      { id: 2, nickname: "评委B", tel: "138****0002", isJudges: 1, user_state: 1 },
      { id: 3, nickname: "评委C", tel: "138****0003", isJudges: 1, user_state: 1 }
    ],
    excelUsers: [],
    judges: [
      { id: 1, nickname: "评委A", tel: "138****0001", source: "preview", user_state: 1 },
      { id: 2, nickname: "评委B", tel: "138****0002", source: "preview", user_state: 1 },
      { id: 3, nickname: "评委C", tel: "138****0003", source: "preview", user_state: 1 }
    ],
    groupJudges: [
      { comps_id: 1, group_id: 101, judges_id: 1 }, { comps_id: 1, group_id: 101, judges_id: 2 }, { comps_id: 1, group_id: 101, judges_id: 3 },
      { comps_id: 1, group_id: 102, judges_id: 1 }, { comps_id: 1, group_id: 102, judges_id: 2 },
      { comps_id: 2, group_id: 201, judges_id: 1 }, { comps_id: 2, group_id: 201, judges_id: 3 }
    ],
    players: [
      { id: "p1", uid: 10, cid: 1, tid: 101, name: "张雨桐", show_name: "波斯之夜", group_name: "AiwaRaks培训中心", zhidao: "导师A", bianwu: "编舞A", sign_time: "2025-05-14 14:30:22", isPaySuccess: 1, cost: 299, mp3_file: "music-a.mp3", mp3FileName: "波斯之夜.mp3", mp3Time: "03:20", score: 9.685, startOrder: 23 },
      { id: "p2", uid: 11, cid: 1, tid: 101, name: "李若溪", show_name: "月光下的祈祷", group_name: "灵动舞蹈", zhidao: "导师B", bianwu: "编舞B", sign_time: "2025-05-14 14:28:15", isPaySuccess: 1, cost: 299, mp3_file: "music-b.mp3", mp3FileName: "月光.mp3", mp3Time: "03:05", score: 9.542, startOrder: 17 },
      { id: "p3", uid: 12, cid: 1, tid: 102, name: "王思涵", show_name: "沙漠玫瑰", group_name: "舞之韵", sign_time: "2025-05-14 14:15:09", isPaySuccess: 0, cost: 299, mp3_file: "", mp3FileName: "", mp3Time: "", score: 9.478, startOrder: 31 },
      { id: "p4", uid: 13, cid: 2, tid: 201, name: "陈可欣", show_name: "异域风情", group_name: "曼妙舞蹈", sign_time: "2025-05-13 11:20:09", isPaySuccess: 1, cost: 199, mp3_file: "music-d.mp3", mp3FileName: "异域.mp3", mp3Time: "", score: 9.236, startOrder: 9 },
      { id: "p5", uid: 14, cid: 2, tid: 202, name: "刘语嫣", show_name: "晨光", group_name: "魅影东方舞", sign_time: "2025-05-12 10:10:09", isPaySuccess: 1, cost: 199, mp3_file: "", score: 0, startOrder: 15 }
    ],
    scores: [
      { group_id: 101, comps_id: 1, judges_id: 1, scoreValue: 9.6 }, { group_id: 101, comps_id: 1, judges_id: 2, scoreValue: 9.7 }, { group_id: 101, comps_id: 1, judges_id: 3, scoreValue: 9.8 },
      { group_id: 102, comps_id: 1, judges_id: 1, scoreValue: 9.4 }, { group_id: 201, comps_id: 2, judges_id: 3, scoreValue: 9.2 }
    ],
    scoreRules: [{ id: 1 }, { id: 2 }, { id: 3 }],
    integral: [],
    systemUsers: [{ user_id: 1, user_name: "admin" }],
    checks: {
      excelUserRows: 0,
      excelUsersMatchedById: 0,
      excelUsersOnly: 0,
      excelJudgeRows: 3,
      sqlJudgeRows: 3,
      mergedJudgeRows: 3,
      excelJudgePhones: 3
    }
  }
};
