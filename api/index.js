const { google } = require('googleapis');

const jsonResponse = (res, statusCode, data) => {
  res.status(statusCode).json(data);
};

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let privateKey = process.env.PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
      process.env.CLIENT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Unreconcile Sheet ၏ ID
    const SHEET_ID_UNREC = process.env.SHEET_ID_UNREC;

    if (req.method === 'POST') {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
      }

      const { date, ou1, name, employeeId, customerName, customerId, reason, invoiceNumbers } = bodyData || {};

      let invoiceArray = [];
      try {
        if (typeof invoiceNumbers === "string") invoiceArray = JSON.parse(invoiceNumbers);
        else if (Array.isArray(invoiceNumbers)) invoiceArray = invoiceNumbers;
        else invoiceArray = [String(invoiceNumbers)];
      } catch (e) {
        invoiceArray = [String(invoiceNumbers)];
      }

      if (!date || !ou1 || !name || !employeeId || !customerName || !customerId || invoiceArray.length === 0 || !reason) {
        return jsonResponse(res, 200, { status: "error", message: "လိုအပ်သော Data များ ပြည့်စုံမှုမရှိပါ။" });
      }

      // မြန်မာစံတော်ချိန် Timestamp ပြုလုပ်ခြင်း
      const now = new Date();
      const mmTime = new Date(now.getTime() + (6.5 * 60 * 60 * 1000));
      const month = mmTime.getUTCMonth() + 1;
      const day = mmTime.getUTCDate();
      const year = mmTime.getUTCFullYear();
      const hours = String(mmTime.getUTCHours()).padStart(2, '0');
      const minutes = String(mmTime.getUTCMinutes()).padStart(2, '0');
      const seconds = String(mmTime.getUTCSeconds()).padStart(2, '0');
      const timestamp = `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;

      // Date ကို 'YYYY-MM-DD' Format ဖြင့် ပြောင်းပေးခြင်း
      let formattedDate = String(date).trim();
      const dateParts = formattedDate.split('-');
      if (dateParts.length === 3) {
        formattedDate = `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`;
      }
      const sheetDate = "'" + formattedDate;

      // Invoice အရေအတွက်အလိုက် Row တစ်ခုချင်းစီ ဆောက်မည်
      const appendValues = [];
      for (let i = 0; i < invoiceArray.length; i++) {
        appendValues.push([timestamp, sheetDate, ou1, name, employeeId, customerName, customerId, invoiceArray[i], reason]);
      }

      // Unreconciled Sheet သို့ သိမ်းဆည်းခြင်း (Error ဖြစ်စေသော Single Quotes များကို ဖြုတ်ထားပါသည်)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID_UNREC,
        range: "Sheet1!A1", // <-- Single Quote များကို ဖြုတ်လိုက်ပါပြီ[cite: 3]
        valueInputOption: 'USER_ENTERED',
        resource: { values: appendValues }
      });

      return jsonResponse(res, 200, { 
        status: "success", 
        message: `Unreconcile Request (Invoice စုစုပေါင်း ${invoiceArray.length} စောင်) ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။` 
      });
    }

  } catch (error) {
    return jsonResponse(res, 500, { status: "error", message: error.message || String(error) });
  }
};
