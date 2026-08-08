const api = require("../../utils/api");
const { cleanText } = require("../../shared/review-text");

Page({
  data: {
    certificates: [],
    loading: true
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    const certs = await api.getCertificates().catch(() => []);
    const list = (Array.isArray(certs) ? certs : []).map((cert) => ({
      id: cert.id,
      certificateNo: cert.certificateNo || cert.certificate_no || cert.certNo || "",
      courseName: cleanText(cert.courseName || cert.course_name || cert.name || "课程证书"),
      issueDate: String(cert.issueDate || cert.issue_date || "").slice(0, 10) || "待登记日期",
      pdfUrl: cert.pdfUrl || cert.pdf_url || "",
      verifyUrl: cert.verifyUrl || cert.verify_url || "",
      openUrl: cert.pdfUrl || cert.pdf_url || cert.verifyUrl || cert.verify_url || "",
      status: cert.status || "active",
      actionText: (cert.status || "active") === "active" ? "查看" : "已撤销"
    }));
    this.setData({ certificates: list, loading: false });
  },

  viewCertificate(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: "记录文件未生成", icon: "none" });
      return;
    }
    if (/\.pdf(\?|$)/i.test(url)) {
      wx.downloadFile({
        url,
        success(res) {
          if (res.statusCode === 200) {
            wx.openDocument({ filePath: res.tempFilePath, fileType: "pdf" });
          } else {
            wx.showToast({ title: "记录打开失败", icon: "none" });
          }
        },
        fail() {
          wx.showToast({ title: "记录下载失败", icon: "none" });
        }
      });
      return;
    }
    wx.showModal({
      title: "记录链接",
      content: url,
      showCancel: false
    });
  }
});
