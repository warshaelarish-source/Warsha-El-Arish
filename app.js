/* حماية من التضمين داخل iframe (clickjacking) */
if(window.top !== window.self){ document.documentElement.style.display = "none"; }
/* ================= الإعدادات ================= */
const SUPABASE_URL = "https://oliyswglvrhxdmkijann.supabase.co";
const SUPABASE_KEY = "sb_publishable_Gjm1kZ33UbvUAR1KTURxZQ_SRXTmv_A"; // مفتاح عام وآمن
const SUPPORT_WA = "201508207016";
const AREAS = ["حي أول العريش","حي ثاني العريش","حي ثالث العريش","حي رابع العريش","حي السلام","حي النصر","حي الزهور","حي المستقبل","وسط البلد","المنطقة الصناعية","كفر العريش الجديدة","أبو صقل"];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validPhone = p => /^01[0-9]{9}$/.test(p);
const AR_DIGITS = {"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9","۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9"};
function normPhone(s){
  let d = String(s || "").replace(/[٠-٩۰-۹]/g, c => AR_DIGITS[c]).replace(/\D/g, "");
  if(/^201[0-9]{9}$/.test(d)) d = "0" + d.slice(2);
  return d;
}
// رقم الموبايل بصيغة دولية (E.164) عشان Supabase Phone Auth: 01012345678 -> +201012345678
const toE164 = p => "+20" + p.slice(1);
const fmtDate = d => new Date(d).toLocaleDateString("ar-EG", {day:"numeric", month:"short"});
function togglePw(id, btn){
  const i = $(id), show = i.type === "password";
  i.type = show ? "text" : "password";
  btn.textContent = show ? "🙈" : "👁️";
  btn.setAttribute("aria-label", show ? "إخفاء كلمة السر" : "إظهار كلمة السر");
}
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),3000)}

let sb = null, me = null, profile = null, afterLogin = null, current = "s-home", needComplete = false;
let ignored = new Set(), contacted = new Set();
const ignKey = () => "warsha_ignored_" + (me ? me.id : "guest");
function loadIgnored(){ try { ignored = new Set(JSON.parse(localStorage.getItem(ignKey()) || "[]")); } catch(e) { ignored = new Set(); } }
function saveIgnored(){ try { localStorage.setItem(ignKey(), JSON.stringify([...ignored])); } catch(e) {} }

/* ================= التنقل ================= */
const role = () => profile ? profile.role : null;
const isCraft = () => role() === "craftsman";

function buildTabs(){
  const t = [{id:"s-home", ic:"🏠", n:"الرئيسية"}];
  if(!me) t.push({id:"s-request", ic:"📝", n:"انشر طلبك"}, {id:"s-auth", ic:"👤", n:"دخول"});
  else if(isCraft()) t.push({id:"s-jobs", ic:"🛠️", n:"الطلبات"}, {id:"s-chats", ic:"💬", n:"المحادثات"}, {id:"s-account", ic:"👤", n:"حسابي"});
  else t.push({id:"s-request", ic:"📝", n:"انشر طلبك"}, {id:"s-myreq", ic:"📋", n:"طلباتي"}, {id:"s-chats", ic:"💬", n:"المحادثات"}, {id:"s-account", ic:"👤", n:"حسابي"});
  $("tabbar").innerHTML = t.map(x => `<button type="button" data-t="${x.id}" data-act="showScreen" data-arg="${x.id}"><span class="ic">${x.ic}</span>${x.n}${x.id==="s-chats"?'<i class="dot hidden"></i>':""}</button>`).join("");
  markTab(); paintBadges();
}
function markTab(){ document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.t === current)); }

function showScreen(id){
  const needLogin = ["s-request","s-myreq","s-jobs","s-account","s-chats","s-chat","s-rate","s-notifs"];
  if(needLogin.includes(id) && !me){
    afterLogin = id;
    $("auth-msg").textContent = id === "s-request" ? "سجّل دخول الأول عشان تنشر طلبك" : "سجّل دخول الأول";
    id = "s-auth";
  }
  if(me && needComplete) id = "s-complete";
  if(id === "s-request" && isCraft()) id = "s-jobs";
  if((id === "s-myreq") && isCraft()) id = "s-jobs";
  if(id === "s-jobs" && me && !isCraft()) id = "s-myreq";
  if(id === "s-chat" && !cur) id = "s-chats";
  if(current === "s-chat" && id !== "s-chat") closeChatCh();
  current = id;
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0,0);
  markTab();
  if(id === "s-myreq") loadMyRequests();
  if(id === "s-jobs") loadJobs();
  if(id === "s-account") loadAccount();
  if(id === "s-chats"){ if(!keepF) chatFilter = null; keepF = false; renderChats(); }
  if(id === "s-chat") startChat();
  if(id === "s-notifs") renderNotifs();
  document.body.classList.toggle("in-chat", id === "s-chat");
  $("bell").classList.toggle("hidden", !(me && profile) || ["s-chat","s-notifs","s-auth","s-complete","s-rate"].includes(id));
}
function goRequest(){ showScreen("s-request"); }
function quickRequest(cat){
  const o = [...$("q-cat").options].find(x => x.textContent.startsWith(cat));
  if(o) $("q-cat").value = o.value;
  showScreen("s-request");
}
function goJoin(){
  if(me){ showScreen(isCraft() ? "s-jobs" : "s-account"); return; }
  afterLogin = null;
  $("auth-msg").textContent = "اعمل حساب صنايعي وهنراجع بياناتك";
  authTab("signup");
  document.querySelector('input[name="s-role"][value="craftsman"]').checked = true;
  roleChange();
  showScreen("s-auth");
}

/* ================= الحسابات ================= */
function authTab(w){
  $("t-login").classList.toggle("on", w === "login");
  $("t-signup").classList.toggle("on", w === "signup");
  $("f-login").classList.toggle("hidden", w !== "login");
  $("f-signup").classList.toggle("hidden", w !== "signup");
}
function roleChange(){
  const c = document.querySelector('input[name="s-role"]:checked').value === "craftsman";
  $("craft-fields").classList.toggle("hidden", !c);
}
function authError(err){
  const m = (err && err.message || "").toLowerCase();
  if(m.includes("already") || m.includes("registered")) return "الرقم ده مسجّل قبل كده، ادخل بيه";
  if(m.includes("invalid login")) return "الرقم أو كلمة السر غلط";
  if(m.includes("password")) return "كلمة السر ضعيفة، اكتب 8 حروف على الأقل";
  if(m.includes("rate") || m.includes("too many")) return "محاولات كتير، استنى شوية وجرب تاني";
  if((m.includes("phone") || m.includes("email")) && m.includes("invalid")) return "الرقم مش مقبول، راجعه وجرب تاني";
  if(m.includes("database")) return "حصلت مشكلة في البيانات، راجع الاسم والرقم وجرب تاني";
  return "حصلت مشكلة، جرب تاني";
}
async function forceLogout(msg){
  me = null; profile = null; contacted = new Set(); ignored = new Set(); stopNotifs(); cur = null;
  buildTabs(); showScreen("s-home"); toast(msg || "الحساب ده مبقاش موجود، تم تسجيل الخروج");
  try { await sb.auth.signOut({ scope: "local" }); } catch(e) {}
}
// بيتأكد من السيرفر إن المستخدم لسه موجود، لو اتحذف بيعمل تسجيل خروج تلقائي
async function checkUserStillExists(){
  try {
    const { data, error } = await sb.auth.getUser();
    if(error && [401, 403, 404].includes(error.status)) return false;
    if(!error && !data.user) return false;
  } catch(e) {}
  return true;
}
async function loadProfile(){
  needComplete = false;
  if(!me){ profile = null; return; }
  const { data, error } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
  if(error){
    // الجلسة نفسها مرفوضة = الحساب اتمسح
    if([401, 403].includes(error.status) || /jwt|sub claim/i.test(error.message || "")){ await accountDeleted(); return; }
    profile = null; // مشكلة اتصال عادية
    return;
  }
  // مفيش خطأ ومفيش بروفايل = الحساب اتمسح
  if(!data){
    // مستخدم جوجل لسه ماكمّلش بياناته (الحساب موجود في السيرفر بس مفيش بروفايل)
    if(isGoogleUser() && await checkUserStillExists()){ profile = null; needComplete = true; prefillComplete(); return; }
    await accountDeleted(); return;
  }
  profile = data;
  startNotifs();
}
async function accountDeleted(){
  await forceLogout("حسابك اتمسح، اعمل حساب جديد");
  authTab("signup");
  $("auth-msg").textContent = "حسابك اتمسح، اعمل حساب جديد";
  showScreen("s-auth");
}
const isGoogleUser = () => !!me && ((me.app_metadata && me.app_metadata.provider === "google") || (me.identities || []).some(i => i.provider === "google"));
async function googleLogin(){
  if(!sb) return toast("حدّث الصفحة وجرب تاني");
  try { localStorage.setItem("warsha_google", "1"); if(afterLogin) localStorage.setItem("warsha_after", afterLogin); } catch(e) {}
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } }
  });
  if(error) toast("تعذّر الدخول بجوجل، جرب تاني");
}
function prefillComplete(){
  const m = (me && me.user_metadata) || {};
  if(!$("c-name").value) $("c-name").value = m.full_name || m.name || "";
}
function cRoleChange(){
  $("c-craft").classList.toggle("hidden", document.querySelector('input[name="c-role"]:checked').value !== "craftsman");
}
async function completeProfile(e){
  e.preventDefault();
  const r = document.querySelector('input[name="c-role"]:checked').value;
  const full_name = $("c-name").value.trim(), phone = normPhone($("c-phone").value);
  if(full_name.length < 3) return toast("اكتب اسمك بالكامل");
  if(!validPhone(phone)) return toast("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
  const args = { p_role: r, p_full_name: full_name, p_phone: phone, p_category: null, p_area: null, p_experience_years: null, p_bio: null };
  if(r === "craftsman"){
    const exp = $("c-exp").value.trim();
    if(!/^\d{1,2}$/.test(exp)) return toast("اكتب سنين خبرتك بالأرقام");
    Object.assign(args, { p_category: $("c-cat").value, p_area: $("c-area").value, p_experience_years: parseInt(exp, 10), p_bio: $("c-bio").value.trim() || null });
  }
  const b = $("c-btn"); b.disabled = true;
  const { error } = await sb.rpc("complete_profile", args);
  b.disabled = false;
  if(error) return toast(/duplicate|unique/i.test(error.message || "") ? "رقم الموبايل ده مسجّل قبل كده" : "حصلت مشكلة في حفظ البيانات، جرب تاني");
  await loadProfile();
  if(!profile) return toast("مقدرناش نحمّل بياناتك، حدّث الصفحة");
  buildTabs();
  toast(r === "craftsman" ? "تم! حسابك قيد المراجعة ⏳" : "تم إنشاء حسابك 🎉");
  const go = afterLogin; afterLogin = null;
  showScreen(go || (isCraft() ? "s-jobs" : "s-home"));
}
async function afterAuth(session){
  me = session.user;
  loadIgnored();
  await loadProfile();
  if(!me) return; // الحساب اتحذف واتعمل تسجيل خروج تلقائي
  if(!profile) toast("مقدرناش نحمّل بياناتك، حدّث الصفحة");
  buildTabs();
  const go = afterLogin; afterLogin = null;
  showScreen(go || (isCraft() ? "s-jobs" : "s-home"));
}
async function doLogin(e){
  e.preventDefault();
  const phone = normPhone($("l-phone").value), password = $("l-pass").value;
  if(!validPhone(phone)) return toast("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
  if(!password) return toast("اكتب كلمة السر");
  const b = $("l-btn"); b.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ phone: toE164(phone), password });
  b.disabled = false;
  if(error || !data.session) return toast(authError(error));
  $("l-pass").value = "";
  toast("أهلاً بيك 👋");
  afterAuth(data.session);
}
async function doSignup(e){
  e.preventDefault();
  const r = document.querySelector('input[name="s-role"]:checked').value;
  const full_name = $("s-name").value.trim(), phone = normPhone($("s-phone").value);
  const password = $("s-pass").value;
  if(full_name.length < 3) return toast("اكتب اسمك بالكامل");
  if(!validPhone(phone)) return toast("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
  if(password.length < 8) return toast("كلمة السر لازم 8 على الأقل");
  if(password === phone || /^(.)\1+$/.test(password)) return toast("كلمة السر ضعيفة، اختار حاجة أصعب");
  const meta = { full_name, phone, role: r };
  if(r === "craftsman"){
    const exp = $("s-exp").value.trim();
    if(!/^\d{1,2}$/.test(exp)) return toast("اكتب سنين خبرتك بالأرقام");
    Object.assign(meta, { category: $("s-cat").value, area: $("s-area").value, experience_years: exp, bio: $("s-bio").value.trim() });
  }
  const b = $("s-btn"); b.disabled = true;
  const { data, error } = await sb.auth.signUp({ phone: toE164(phone), password, options: { data: meta } });
  b.disabled = false;
  if(error) return toast(authError(error));
  if(!data.session) return toast("تم إنشاء الحساب، جرّب تدخل برقم الموبايل وكلمة السر");
  $("s-pass").value = "";
  toast(r === "craftsman" ? "تم! حسابك قيد المراجعة ⏳" : "تم إنشاء حسابك 🎉");
  afterAuth(data.session);
}
async function logout(){
  me = null; profile = null; contacted = new Set(); ignored = new Set(); stopNotifs(); cur = null;
  buildTabs(); showScreen("s-home"); toast("تم تسجيل الخروج");
  try { await sb.auth.signOut(); } catch(e) {}
}

/* ================= نشر طلب ================= */
async function submitRequest(e){
  e.preventDefault();
  if(!me){
    afterLogin = "s-request"; // يرجع للطلب بعد الدخول
    $("auth-msg").textContent = "سجّل دخول الأول عشان تنشر طلبك";
    return showScreen("s-auth");
  }
  if(isCraft()) return toast("حساب الصنايعي مش بينشر طلبات");
  const full = $("q-cat").value, category = full.split(" — ")[0];
  const area = $("q-area").value, details = $("q-details").value.trim();
  if(!AREAS.includes(area)) return toast("اختار المنطقة");
  if(details.length < 5) return toast("اكتب تفاصيل الشغل بشكل أوضح");
  const b = $("q-btn"); b.disabled = true;
  let error = null;
  try { ({ error } = await sb.from("requests").insert({ customer_id: me.id, category, work_type: full, area, details })); }
  catch(err) { error = err; }
  finally { b.disabled = false; } // الزرار مايفضلش مقفول لو حصل استثناء
  if(error) return toast("ماقدرناش ننشر الطلب، جرب تاني");
  $("q-details").value = "";
  toast("تم نشر طلبك ✅");
  showScreen("s-myreq");
}

/* ================= طلباتي (عميل) ================= */
const STATUS = { open:["b-open","منشور"], cancelled:["b-cancel","ملغي"], closed:["b-ok","✅ تم الشغل"] };
async function fetchMyRequests(){
  const r = await sb.from("requests").select("*").eq("customer_id", me.id).order("created_at", { ascending:false });
  if(r.error) return null;
  const ids = r.data.map(x => x.id), counts = {};
  if(ids.length){
    const c = await sb.from("contacts").select("request_id").in("request_id", ids);
    (c.data || []).forEach(x => counts[x.request_id] = (counts[x.request_id] || 0) + 1);
  }
  const rv = await sb.from("reviews").select("request_id,rating").eq("customer_id", me.id), rm = {};
  (rv.data || []).forEach(v => rm[v.request_id] = v.rating);
  return r.data.map(x => ({ ...x, n: counts[x.id] || 0, rate: rm[x.id] }));
}
async function loadMyRequests(){
  const box = $("myreq-list");
  box.innerHTML = '<p class="mut" style="text-align:center">جاري التحميل...</p>';
  const list = await fetchMyRequests();
  if(!list) return box.innerHTML = '<div class="empty"><div class="big">⚠️</div><p>مقدرناش نحمّل طلباتك، حدّث الصفحة</p></div>';
  if(!list.length) return box.innerHTML = '<div class="empty"><div class="big">📭</div><h3>لسه مفيش طلبات</h3><button class="btn btn-pri" style="margin-top:14px" data-act="showScreen" data-arg="s-request">انشر أول طلب</button></div>';
  box.innerHTML = list.map(r => {
    const [cls, txt] = STATUS[r.status] || STATUS.open;
    return `<div class="req">
      <div class="top"><b>${esc(r.work_type)}</b><span class="badge ${cls}">${txt}</span></div>
      <div class="meta">📍 ${esc(r.area)} — 🗓️ ${fmtDate(r.created_at)}</div>
      <div class="det">${esc(r.details)}</div>
      <div class="meta">${r.n ? `🤝 تواصل معاك ${r.n} صنايعي` : "⏳ لسه ماحدش تواصل"}</div>
      <div class="acts">${r.n ? `<button class="btn-s g" type="button" data-id="${esc(r.id)}" data-act="showChats">💬 المحادثات</button>` : ""}${r.status === "open" ? `<button class="btn-s bad" type="button" data-id="${esc(r.id)}" data-act="cancelRequest">إلغاء الطلب</button>` : ""}${r.status === "closed" && r.completed_by ? (r.rate ? `<span class="meta">⭐ قيّمت: ${stars(r.rate)}</span>` : `<button class="btn-s ok" type="button" data-r="${esc(r.id)}" data-c="${esc(r.completed_by)}" data-act="rateReq">⭐ قيّم الصنايعي</button>`) : ""}</div>
    </div>`;
  }).join("");
}
async function cancelRequest(id){
  if(!confirm("متأكد إنك عايز تلغي الطلب ده؟")) return;
  const { error } = await sb.from("requests").update({ status:"cancelled" }).eq("id", id).eq("customer_id", me.id).eq("status","open");
  if(error) return toast("ماقدرناش نلغي الطلب، جرب تاني");
  toast("تم إلغاء الطلب");
  loadMyRequests();
}

/* ================= الطلبات (صنايعي) ================= */
let jobs = [];
async function loadJobs(){
  const box = $("jobs-list"), sub = $("jobs-sub");
  if(!profile) await loadProfile();
  if(!profile || !profile.approved){
    sub.textContent = "";
    return box.innerHTML = '<div class="empty"><div class="big">⏳</div><h3>حسابك قيد المراجعة</h3><p style="margin-top:6px;line-height:1.9">هنراجع بياناتك ونفعّل حسابك، وبعدها هتشوف الطلبات هنا.</p></div>';
  }
  sub.textContent = "طلبات " + profile.category + " المنشورة";
  box.innerHTML = '<p class="mut" style="text-align:center">جاري التحميل...</p>';
  const [r, c] = await Promise.all([
    sb.from("requests").select("id,work_type,area,details,created_at").eq("status","open").eq("category", profile.category).order("created_at", { ascending:false }),
    sb.from("contacts").select("request_id").eq("craftsman_id", me.id)
  ]);
  if(r.error) return box.innerHTML = '<div class="empty"><div class="big">⚠️</div><p>مقدرناش نحمّل الطلبات، حدّث الصفحة</p></div>';
  contacted = new Set((c.data || []).map(x => x.request_id));
  jobs = r.data;
  renderJobs();
}
function renderJobs(){
  const box = $("jobs-list");
  const list = jobs.filter(j => contacted.has(j.id) || !ignored.has(j.id));
  if(!list.length) return box.innerHTML = '<div class="empty"><div class="big">📭</div><h3>مفيش طلبات دلوقتي</h3><p>هتظهر هنا أول ما حد ينشر طلب في تخصصك</p></div>';
  box.innerHTML = list.map(j => {
    const done = contacted.has(j.id);
    return `<div class="req">
      <div class="top"><b>${esc(j.work_type)}</b>${done ? '<span class="badge b-ok">✓ تم التواصل</span>' : ""}</div>
      <div class="meta">📍 ${esc(j.area)} — 🗓️ ${fmtDate(j.created_at)}</div>
      <div class="det">${esc(j.details)}</div>
      <div class="acts">
        <button class="btn-s ok" type="button" data-id="${esc(j.id)}" data-act="contactJob">${done ? "💬 افتح المحادثة" : "💬 تواصل"}</button>
        ${done ? "" : `<button class="btn-s g" type="button" data-id="${esc(j.id)}" data-act="ignoreJob">تجاهل</button>`}
      </div>
    </div>`;
  }).join("");
}
function ignoreJob(id){ ignored.add(id); saveIgnored(); renderJobs(); }
async function contactJob(id){
  const was = contacted.has(id);
  const { data, error } = await sb.rpc("contact_request", { p_request_id: id });
  if(error || !data || !data.length){ toast("الطلب ده مش متاح دلوقتي"); return loadJobs(); }
  const j = jobs.find(x => x.id === id);
  contacted.add(id); renderJobs();
  if(!was) await sb.rpc("send_message", { p_request_id: id, p_craftsman_id: me.id, p_body: `أهلاً ${data[0].customer_name}، أنا ${profile.full_name} صنايعي ${profile.category}. شفت طلبك${j ? " (" + j.work_type + " في " + j.area + ")" : ""} وأقدر أساعدك. ينفع نتفق؟` });
  openChat(id, me.id);
}

/* ================= حسابي ================= */
async function loadAccount(){
  const box = $("acc-box");
  box.innerHTML = '<p class="mut" style="text-align:center">جاري التحميل...</p>';
  if(!profile) await loadProfile();
  if(!me) return; // اتعمل تسجيل خروج تلقائي
  if(!profile) return box.innerHTML = '<div class="empty"><div class="big">⚠️</div><p>مقدرناش نحمّل بياناتك، حدّث الصفحة</p></div>';
  const p = profile;
  let html = `<div class="card"><div class="kv"><span>الاسم</span><b>${esc(p.full_name)}</b></div>
    <div class="kv"><span>رقم الموبايل</span><b dir="ltr">${esc(p.phone)}</b></div>
    <div class="kv"><span>نوع الحساب</span><b>${p.role === "craftsman" ? "صنايعي" : "عميل"}</b></div>`;
  let history = "";
  if(p.role === "craftsman"){
    const { data } = await sb.rpc("my_contacts");
    const rv = (await sb.from("reviews").select("rating").eq("craftsman_id", me.id)).data || [], avg = rv.length ? (rv.reduce((t, x) => t + x.rating, 0) / rv.length).toFixed(1) : null;
    const list = data || [];
    html += `<div class="kv"><span>التخصص</span><b>${esc(p.category)}</b></div>
      <div class="kv"><span>حالة الحساب</span><b>${p.approved ? "✅ معتمد" : "⏳ قيد المراجعة"}</b></div>
      <div class="kv"><span>التقييم</span><b>${avg ? "⭐ " + avg + " (" + rv.length + ")" : "لسه مفيش"}</b></div>
      <div class="kv"><span>طلبات تواصلت معاها</span><b>${list.length}</b></div></div>`;
    history = list.length ? list.map(x => `<div class="req"><div class="top"><b>${esc(x.work_type)}</b><span class="badge b-info">${fmtDate(x.contacted_at)}</span></div>
      <div class="meta">👤 ${esc(x.customer_name)} — 📍 ${esc(x.area)}</div></div>`).join("") : '<p class="mut">لسه ماتواصلتش مع أي عميل</p>';
  } else {
    const list = (await fetchMyRequests()) || [];
    html += `<div class="kv"><span>عدد الطلبات المنشورة</span><b>${list.length}</b></div></div>`;
    history = list.length ? list.map(x => { const [cls, txt] = STATUS[x.status] || STATUS.open;
      return `<div class="req"><div class="top"><b>${esc(x.work_type)}</b><span class="badge ${cls}">${txt}</span></div>
      <div class="meta">🗓️ ${fmtDate(x.created_at)} — ${x.n ? "🤝 تواصل معاك " + x.n + " صنايعي" : "⏳ لسه ماحدش تواصل"}</div></div>`; }).join("") : '<p class="mut">لسه مفيش معاملات</p>';
  }
  html += `<div class="sec-h" style="margin-top:20px"><h3>سجل المعاملات مع الصنايعية</h3></div>${history}
    <button class="btn btn-ghost" type="button" data-act="logout" style="margin-top:20px">تسجيل الخروج</button>`;
  box.innerHTML = html;
}

/* ================= شات / تقييم / إشعارات ================= */
const BASE_TITLE = document.title;
let chats = [], cur = null, chatCh = null, notifCh = null, notifs = [], rateSel = 0, rateT = null, chatFilter = null, keepF = false;
const hm = d => new Date(d).toLocaleTimeString("ar-EG", {hour:"2-digit", minute:"2-digit"});
const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
async function loadChats(){ const { data } = await sb.rpc("my_chats"); chats = data || []; return chats; }
function showChats(f){ chatFilter = f || null; keepF = true; showScreen("s-chats"); }
async function renderChats(){
  const box = $("chats-list");
  box.innerHTML = '<p class="mut" style="text-align:center">جاري التحميل...</p>';
  await loadChats();
  const l = chats.filter(c => !chatFilter || c.req_id === chatFilter);
  box.innerHTML = l.length ? l.map(c => `<div class="req" style="cursor:pointer" data-r="${esc(c.req_id)}" data-c="${esc(c.craft_id)}" data-act="openChat">
    <div class="top"><b>${esc(c.other_name)}${c.other_rating ? ` <small>⭐ ${esc(c.other_rating)}</small>` : ""}</b>${c.unread ? `<span class="badge b-open">${c.unread} جديد</span>` : c.req_status !== "open" ? '<span class="badge b-ok">منتهي</span>' : ""}</div>
    <div class="meta">${esc(c.work_type)} — ${esc(c.area)}</div><div class="det">${esc(c.last_body || "ابدأ المحادثة")}</div></div>`).join("") : '<div class="empty"><div class="big">💬</div><h3>مفيش محادثات لسه</h3></div>';
}
async function openChat(r, c){
  if(!chats.find(x => x.req_id === r && x.craft_id === c)) await loadChats();
  cur = chats.find(x => x.req_id === r && x.craft_id === c);
  if(!cur) return toast("المحادثة مش متاحة");
  showScreen("s-chat");
}
let chatSeq = 0;
function closeChatCh(){
  chatSeq++; // أي startChat لسه شغال في الخلفية هيتلغي
  if(chatCh && sb){ try { sb.removeChannel(chatCh); } catch(e) {} }
  chatCh = null;
}
async function startChat(){
  closeChatCh(); // اقفل أي قناة قديمة قبل ما نفتح واحدة جديدة
  const c = cur, my = chatSeq, open = c.req_status === "open";
  $("ch-name").textContent = c.other_name + (c.other_rating ? " ⭐" + c.other_rating : "");
  $("ch-sub").textContent = c.work_type + " — " + c.area;
  $("ch-done").classList.toggle("hidden", !(open && !isCraft()));
  $("ch-rate").classList.toggle("hidden", !(!isCraft() && c.req_status === "closed" && c.completed_by === c.craft_id && !c.reviewed));
  $("ch-comp").classList.toggle("hidden", !open);
  $("ch-closed").classList.toggle("hidden", open);
  $("ch-closed").textContent = c.req_status === "cancelled" ? "الطلب اتلغى" : "الطلب خلص — المحادثة للقراءة فقط";
  await fetchMsgs();
  if(my !== chatSeq || current !== "s-chat" || cur !== c) return; // المستخدم خرج أو فتح محادثة تانية
  $("ch-msgs").scrollTop = 1e9;
  const seen = () => sb.rpc("mark_chat_read", { p_request_id: c.req_id, p_craftsman_id: c.craft_id }).then(loadNotifs);
  seen();
  if(my !== chatSeq) return;
  chatCh = sb.channel("chat-" + c.req_id + c.craft_id).on("postgres_changes", { event:"*", schema:"public", table:"messages", filter:"request_id=eq." + c.req_id }, () => { fetchMsgs(); seen(); }).subscribe();
}
async function fetchMsgs(){
  const c = cur; if(!c) return;
  const { data } = await sb.from("messages").select("*").eq("request_id", c.req_id).eq("craftsman_id", c.craft_id).order("created_at").limit(300);
  const b = $("ch-msgs"), low = b.scrollHeight - b.scrollTop - b.clientHeight < 90;
  b.innerHTML = (data || []).map(m => `<div class="bub ${m.sender_id === me.id ? "me" : "them"}">${esc(m.body)}<small>${hm(m.created_at)}${m.sender_id === me.id && m.read_at ? " ✓✓" : ""}</small></div>`).join("") || '<p class="mut" style="text-align:center">ابدأ المحادثة 👋</p>';
  if(low) b.scrollTop = b.scrollHeight;
}
async function sendMsg(e){
  e.preventDefault();
  const i = $("ch-in"), t = i.value.trim(); if(!t || !cur) return;
  i.value = ""; i.style.height = "";
  const { error } = await sb.rpc("send_message", { p_request_id: cur.req_id, p_craftsman_id: cur.craft_id, p_body: t });
  if(error){ i.value = t; return toast("الرسالة ماتبعتتش، جرب تاني"); }
  await fetchMsgs(); $("ch-msgs").scrollTop = 1e9;
}
async function finishJob(){
  if(!confirm("الشغل خلص مع " + cur.other_name + "؟ هيتقفل الطلب.")) return;
  const { error } = await sb.rpc("complete_request", { p_request_id: cur.req_id, p_craftsman_id: cur.craft_id });
  if(error) return toast("ماقدرناش ننهي الطلب، جرب تاني");
  await loadChats();
  goRate(chats.find(x => x.req_id === cur.req_id && x.craft_id === cur.craft_id) || cur);
}
async function rateReq(r, c){ await loadChats(); const x = chats.find(v => v.req_id === r && v.craft_id === c); x ? goRate(x) : toast("مقدرناش نفتح التقييم"); }
function goRate(c){ rateT = c; rateSel = 0; paintStars(); $("rt-name").textContent = c.other_name; $("rt-txt").value = ""; showScreen("s-rate"); }
function setStar(n){ rateSel = +n; paintStars(); }
function rateCurrent(){ rateReq(cur.req_id, cur.craft_id); }
function paintStars(){ $("rt-stars").innerHTML = [1,2,3,4,5].map(n => `<button type="button" class="star ${n <= rateSel ? "on" : ""}" data-act="setStar" data-arg="${n}">★</button>`).join(""); }
async function submitRate(e){
  e.preventDefault();
  if(!rateSel) return toast("اختار عدد النجوم");
  const { error } = await sb.rpc("submit_review", { p_request_id: rateT.req_id, p_rating: rateSel, p_comment: $("rt-txt").value.trim() });
  if(error) return toast(/already/.test(error.message || "") ? "قيّمت الطلب ده قبل كده" : "ماقدرناش نحفظ التقييم");
  toast("شكراً لتقييمك ⭐"); showScreen("s-myreq");
}
/* الإشعارات */
async function loadNotifs(){
  if(!me) return;
  const { data } = await sb.from("notifications").select("*").order("created_at", { ascending:false }).limit(40);
  notifs = data || []; paintBadges(); if(current === "s-notifs") renderNotifs();
}
function paintBadges(){
  const u = notifs.filter(n => !n.read), m = u.filter(n => n.type === "message").length;
  const b = $("bell-n"); b.textContent = u.length; b.classList.toggle("hidden", !u.length);
  const t = document.querySelector('#tabbar [data-t="s-chats"] i'); if(t){ t.textContent = m; t.classList.toggle("hidden", !m); }
  document.title = (u.length ? "(" + u.length + ") " : "") + BASE_TITLE;
}
function startNotifs(){
  if(notifCh || !me || !sb) return;
  loadNotifs();
  notifCh = sb.channel("n-" + me.id).on("postgres_changes", { event:"*", schema:"public", table:"notifications", filter:"user_id=eq." + me.id }, p => {
    const n = p.new;
    if(n && n.read === false){
      if(current === "s-chat" && cur && n.request_id === cur.req_id && n.craftsman_id === cur.craft_id){ sb.rpc("mark_chat_read", { p_request_id: cur.req_id, p_craftsman_id: cur.craft_id }); }
      else {
        toast(n.title + (n.body ? " — " + n.body : ""));
        try { navigator.vibrate && navigator.vibrate(150); } catch(e) {}
        if(document.hidden && window.Notification && Notification.permission === "granted"){ try { new Notification(n.title, { body:n.body || "", icon:"favicon.png" }); } catch(e) {} }
      }
    }
    loadNotifs();
  }).subscribe();
}
function stopNotifs(){ closeChatCh(); if(notifCh && sb){ sb.removeChannel(notifCh); } notifCh = null; notifs = []; paintBadges(); }
function renderNotifs(){
  const ask = window.Notification && Notification.permission === "default" ? '<button class="btn btn-ghost" style="margin:0 0 12px" type="button" data-act="askPerm">🔔 فعّل إشعارات المتصفح</button>' : "";
  $("nt-list").innerHTML = ask + (notifs.length ? notifs.map(n => `<div class="req ${n.read ? "" : "unread"}" style="cursor:pointer" data-i="${esc(n.id)}" data-act="openNotif"><div class="top"><b>${esc(n.title)}</b><span class="meta">${fmtDate(n.created_at)} ${hm(n.created_at)}</span></div><div class="det">${esc(n.body || "")}</div></div>`).join("") : '<div class="empty"><div class="big">🔔</div><h3>مفيش إشعارات</h3></div>');
}
async function askPerm(){ try { await Notification.requestPermission(); } catch(e) {} renderNotifs(); }
async function openNotif(id){
  const n = notifs.find(x => x.id === id); if(!n) return;
  await sb.from("notifications").update({ read:true }).eq("id", id); loadNotifs();
  if(n.request_id && n.craftsman_id) return openChat(n.request_id, n.craftsman_id);
  showScreen(n.type === "review" ? "s-account" : isCraft() ? "s-jobs" : "s-chats");
}
async function readAll(){ await sb.from("notifications").update({ read:true }).eq("read", false); loadNotifs(); }
$("ch-in").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey && matchMedia("(pointer:fine)").matches) sendMsg(e); });

/* ================= تشغيل ================= */
function fillAreas(){
  ["q-area","s-area","c-area"].forEach(id => AREAS.forEach(a => { const o = document.createElement("option"); o.textContent = a; $(id).appendChild(o); }));
}
async function init(){
  fillAreas();
  buildTabs();
  if(!window.supabase){ toast("تعذّر تحميل الموقع بالكامل، حدّث الصفحة"); return; }
  // لو الدخول بجوجل رجّع خطأ في الرابط، نعرضه عشان نعرف السبب
  let oauthErr = "";
  try {
    const q = new URLSearchParams(location.hash.replace(/^#/, "") + "&" + location.search.replace(/^\?/, ""));
    oauthErr = q.get("error_description") || q.get("error") || "";
  } catch(e) {}
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  try {
    const { data } = await sb.auth.getSession();
    if(data.session){
      me = data.session.user; loadIgnored(); await loadProfile(); buildTabs();
      let fromGoogle = false;
      try {
        fromGoogle = localStorage.getItem("warsha_google") === "1";
        afterLogin = localStorage.getItem("warsha_after");
        localStorage.removeItem("warsha_google"); localStorage.removeItem("warsha_after");
      } catch(e) {}
      if(location.hash.includes("access_token") || location.search.includes("code=")) history.replaceState(null, "", location.pathname);
      if(needComplete) showScreen("s-complete");
      else if(fromGoogle && profile){ toast("أهلاً بيك 👋"); const go = afterLogin; afterLogin = null; showScreen(go || (isCraft() ? "s-jobs" : "s-home")); }
    } else { try { localStorage.removeItem("warsha_google"); } catch(e) {} }
  } catch(e) {}
  if(oauthErr){
    history.replaceState(null, "", location.pathname);
    showScreen("s-auth");
    $("auth-msg").textContent = "خطأ من الدخول بجوجل: " + oauthErr;
  }
  // لو المستخدم رجع للصفحة بعد ما حسابه اتحذف، نتأكد ونطلّعه
  document.addEventListener("visibilitychange", async () => {
    if(document.visibilityState === "visible" && me && !(await checkUserStillExists())) forceLogout();
  });
  sb.auth.onAuthStateChange(ev => {
    if(ev === "SIGNED_OUT" && me){
      me = null; profile = null; contacted = new Set(); ignored = new Set(); stopNotifs(); cur = null;
      buildTabs(); showScreen("s-home"); toast("انتهت الجلسة، ادخل تاني");
    }
  });
}
init();


/* ================= Event delegation (بدل onclick المضمّنة، عشان الـ CSP من غير unsafe-inline) ================= */
const D = e => e.dataset;
const ACT_ARGS = {
  showChats: e => [D(e).id], cancelRequest: e => [D(e).id], contactJob: e => [D(e).id], ignoreJob: e => [D(e).id],
  openNotif: e => [D(e).i], openChat: e => [D(e).r, D(e).c], rateReq: e => [D(e).r, D(e).c]
};
const INPUT_FX = { autosize: el => { el.style.height = ""; el.style.height = Math.min(el.scrollHeight, 110) + "px"; } };
function dispatch(attr, ev){
  const el = ev.target.closest("[" + attr + "]"); if(!el) return;
  const name = el.getAttribute(attr);
  if(attr === "data-input"){ if(INPUT_FX[name]) INPUT_FX[name](el); return; }
  const fn = window[name]; if(typeof fn !== "function") return;
  if(attr === "data-submit") return fn(ev);
  const args = ACT_ARGS[name] ? ACT_ARGS[name](el) : [D(el).arg, el];
  fn(...args);
}
document.addEventListener("click", ev => dispatch("data-act", ev));
document.addEventListener("change", ev => dispatch("data-change", ev));
document.addEventListener("input", ev => dispatch("data-input", ev));
document.addEventListener("submit", ev => dispatch("data-submit", ev));
