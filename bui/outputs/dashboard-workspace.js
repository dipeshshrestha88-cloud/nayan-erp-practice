/* Plain-language overview, using the same records as Projects and Finance. */
(function () {
  const numeric = value => Number(value) || 0;
  const sum = (rows, key) => Math.round(rows.reduce((total, row) => total + numeric(row[key]), 0) * 100) / 100;
  function summarize(projects, guarantees, logs, today) {
    const active = projects.filter(p => !['closed', 'completed', 'cancelled', 'canceled'].includes(String(p.status).toLowerCase()));
    const unreleased = guarantees.filter(g => !g.released && g.status !== 'Released');
    const activeGuarantees = unreleased.filter(g => g.expiryDate >= today && (!g.issueDate || g.issueDate <= today));
    const expenses = logs.flatMap(log => log.expenses || []);
    const projectRows = active.map(p => ({...p, spent: sum(expenses.filter(e => e.projectId === p.id), 'amount')}));
    const soon = new Date(today + 'T00:00:00Z'); soon.setUTCDate(soon.getUTCDate() + 30);
    return {
      projects: projectRows, contractValue: sum(active, 'contractValue'),
      guarantees: activeGuarantees, guaranteeValue: sum(activeGuarantees, 'amount'),
      expenseTotal: sum(expenses, 'amount'), expenseCount: expenses.length,
      categories: [...new Set(expenses.map(e => e.category))].map(name => ({name, amount: sum(expenses.filter(e => e.category === name), 'amount')})).sort((a,b) => b.amount-a.amount),
      delayed: active.filter(p => /delay|critical/i.test(p.status)),
      expired: unreleased.filter(g => g.expiryDate && g.expiryDate < today),
      expiring: activeGuarantees.filter(g => g.expiryDate <= soon.toISOString().slice(0,10)),
      recent: [...expenses].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,4).map(e => ({...e, projectName: projects.find(p => p.id === e.projectId)?.name || 'Project'}))
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {summarize}; return; }
  const root = document.getElementById('executiveDashboard');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => 'NPR ' + numeric(value).toLocaleString('en-IN', {minimumFractionDigits:Number.isInteger(numeric(value))?0:2,maximumFractionDigits:2});
  const style = document.createElement('style');
  style.textContent = `
    #dashboard .overview-intro{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 22px}
    #dashboard .overview-intro p{color:var(--muted);margin:0;line-height:1.6}
    #dashboard .overview-date{display:block;font-size:11px;margin-top:4px;color:var(--muted)}
    #dashboard .overview-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
    #dashboard .overview-stat{font:inherit;text-align:left;padding:21px 18px;cursor:pointer;color:var(--ink);position:relative;transition:transform .15s,border-color .15s}
    #dashboard .overview-stat:hover{transform:translateY(-2px);border-color:#94abc9}
    #dashboard .overview-stat:first-child{background:#203f70;color:white;border-color:#203f70}
    #dashboard .overview-stat:first-child .overview-label,#dashboard .overview-stat:first-child small{color:#d7e5fa}
    #dashboard .overview-label{display:block;font-size:12px;color:#5b6b7e;margin-bottom:17px}
    #dashboard .overview-stat strong{display:block;font-size:clamp(19px,1.8vw,27px);letter-spacing:-.8px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;min-height:52px}
    #dashboard .overview-currency{display:block;font-size:10px;font-weight:500;letter-spacing:.5px;margin-bottom:5px;min-height:12px}
    #dashboard .overview-stat small{display:block;font-size:11px;color:#67768a;margin-top:10px;line-height:1.5}
    #dashboard .overview-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,1fr);gap:18px;align-items:start}
    #dashboard .overview-stack{display:grid;gap:18px}
    #dashboard .overview-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
    #dashboard h2{margin:0;font-size:16px;letter-spacing:-.3px}
    #dashboard .overview-link{border:0;background:none;color:#254a82;cursor:pointer;padding:4px;font:inherit;font-size:12px;font-weight:600}
    #dashboard .overview-project{border-top:1px solid var(--line);padding:18px 0 4px;margin-top:16px}
    #dashboard .overview-project:first-of-type{margin-top:0}
    #dashboard .overview-project-title{display:flex;justify-content:space-between;align-items:start;gap:12px}
    #dashboard .overview-project-title button{font-size:14px;text-align:left;padding:0;line-height:1.5}
    #dashboard .overview-project-title .sub{line-height:1.5}
    #dashboard .overview-project-details{display:flex;gap:30px;margin:16px 0 8px;flex-wrap:wrap}
    #dashboard .overview-project-details span{font-size:11px;color:var(--muted)}
    #dashboard .overview-project-details b{display:block;color:var(--ink);font-size:13px;margin-top:4px;font-variant-numeric:tabular-nums}
    #dashboard .overview-alert{display:block;width:100%;text-align:left;border:1px solid #f0ddbd;background:#fff9ee;padding:13px;border-radius:8px;margin-top:10px;cursor:pointer;color:#77521f;font:inherit;font-size:12px;line-height:1.5}
    #dashboard .overview-alert strong{display:block;color:#704812;margin-bottom:3px}
    #dashboard .overview-alert.expired{background:#fff4f2;border-color:#f1d8d3;color:#943e31}
    #dashboard .overview-alert.expired strong{color:#943e31}
    #dashboard .overview-note{font-size:11px;line-height:1.6;color:var(--muted);margin:14px 0 0}
    #dashboard .overview-expense{display:flex;justify-content:space-between;gap:16px;padding:13px 0;border-top:1px solid var(--line);font-size:12px}
    #dashboard .overview-expense b{white-space:nowrap;font-variant-numeric:tabular-nums}
    #dashboard .overview-category{margin-top:17px;font-size:12px}
    #dashboard .overview-category div:first-child{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}
    #dashboard .overview-category .fill{background:#446ba3}
    #dashboard .overview-empty{padding:20px 0;color:var(--muted);font-size:13px;line-height:1.7}
    #dashboard button:focus-visible{outline:3px solid #80a9e8;outline-offset:3px}
    @media(max-width:1150px){#dashboard .overview-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#dashboard .overview-grid{grid-template-columns:1fr}}
    @media(max-width:580px){#dashboard .overview-metrics{gap:10px}#dashboard .overview-stat{padding:16px 12px}#dashboard .overview-stat strong{font-size:20px}#dashboard .overview-project-title{flex-direction:column}#dashboard .overview-intro{align-items:flex-start}}
  `;
  document.head.append(style);
  function render(data) {
    const card = (label, value, note, action) => `<button class="card overview-stat" data-go="${action}"><span class="overview-label">${label} ↗</span><strong><span class="overview-currency">${String(value).startsWith('NPR ')?'NPR':''}</span>${String(value).replace(/^NPR /,'')}</strong><small>${note}</small></button>`;
    const alerts = [];
    if(data.delayed.length) alerts.push(`<button class="overview-alert" ${data.delayed.length===1?'data-project="'+escape(data.delayed[0].id)+'"':'data-go="projects"'}><strong>${data.delayed.length} project${data.delayed.length===1?'':'s'} marked as delayed</strong>${escape(data.delayed.map(p=>p.name).join(' · '))} →</button>`);
    if(data.expired.length) alerts.push(`<button class="overview-alert expired" data-go="guarantees"><strong>${data.expired.length} expired guarantee${data.expired.length===1?'':'s'} to review</strong>Still marked as unreleased. Check their status →</button>`);
    if(data.expiring.length) alerts.push(`<button class="overview-alert" data-go="guarantees"><strong>${data.expiring.length} guarantee${data.expiring.length===1?'':'s'} expiring within 30 days</strong>Review renewal or release dates →</button>`);
    root.innerHTML = `
      <div class="overview-intro"><div><p>Your business at a glance.</p><span class="overview-date">Updated ${escape(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))} · Amounts in NPR</span></div><button class="secondary" id="overviewRefresh">↻ Refresh</button></div>
      <div class="overview-metrics">
        ${card('Active projects',data.projects.length,'Projects still open','projects')}
        ${card('Total contract value',money(data.contractValue),'Across active projects','projects')}
        ${card('Active bank guarantees',data.guarantees.length,money(data.guaranteeValue)+' guaranteed','guarantees')}
        ${card('Total site expenses',money(data.expenseTotal),data.expenseCount+' recorded payments · all projects','expenses')}
      </div>
      <div class="overview-grid"><div class="overview-stack">
        <div class="card"><div class="overview-heading"><h2>Active projects</h2><button class="overview-link" data-go="projects">View all →</button></div>
          ${data.projects.map(p=>`<article class="overview-project"><div class="overview-project-title"><div><button class="overview-link" data-project="${escape(p.id)}">${escape(p.name)} ↗</button><span class="sub">${escape(p.client)}</span></div><span class="status ${/delay|critical/i.test(p.status)?'hold':p.status==='Setup'?'risk':'on'}">${escape(p.status)}</span></div><div class="overview-project-details"><span>Contract value<b>${money(p.contractValue)}</b></span><span>Site expenses<b>${money(p.spent)}</b></span><span>Completion date<b>${escape(p.completionDate||'Not set')}</b></span></div></article>`).join('')||'<div class="overview-empty">No active projects yet. Add a project to see it here.</div>'}
        </div>
        <div class="card" id="overviewExpenses"><div class="overview-heading"><h2>Latest expenses</h2><button class="overview-link" data-go="projects">Open project logs →</button></div>
          ${data.recent.map(e=>`<div class="overview-expense"><div><button class="overview-link" data-expense-project="${escape(e.projectId)}">${escape(e.description)} ↗</button><span class="sub">${escape(e.projectName)} · ${escape(e.date)}</span></div><b>${money(e.amount)}</b></div>`).join('')||'<div class="overview-empty">No expenses recorded yet. Record a payment in a project’s expense log.</div>'}
        </div>
      </div><div class="overview-stack">
        <div class="card"><h2>Needs attention</h2>${alerts.join('')||'<div class="overview-empty">You’re up to date. No projects marked as delayed or guarantees due for review.</div>'}<p class="overview-note">Based on project statuses and guarantee expiry dates.</p></div>
        <div class="card"><h2>Where the money went</h2>${data.categories.map(c=>`<div class="overview-category"><div><span>${escape(c.name==='Labor'?'Labour':c.name)}</span><b>${money(c.amount)}</b></div><div class="bar"><div class="fill" style="width:${data.expenseTotal?Math.min(100,c.amount/data.expenseTotal*100):0}%"></div></div></div>`).join('')||'<div class="overview-empty">Your expense breakdown will appear after the first payment.</div>'}<p class="overview-note">Site expense logs · all dates and projects. Vendor bills and other registers are excluded.</p></div>
      </div></div>
      <p class="overview-note">Active guarantees have been issued, have not expired, and are not released. Expired guarantees are listed for review above.</p>`;
    root.querySelector('#overviewRefresh').onclick = refresh;
    root.querySelectorAll('[data-go]').forEach(button => button.onclick = async () => {
      if(button.dataset.go==='expenses') {root.querySelector('#overviewExpenses').scrollIntoView({behavior:'smooth',block:'center'});return;}
      if(button.dataset.go==='guarantees') {activateAppView('finance');await loadFinance();showFinance('guarantees');return;}
      activateAppView('projects');
    });
    root.querySelectorAll('[data-project]').forEach(button => button.onclick = () => window.nayanOpenProject(button.dataset.project));
    root.querySelectorAll('[data-expense-project]').forEach(button => button.onclick = () => window.nayanOpenProject(button.dataset.expenseProject,'expenses'));
  }
  let sequence = 0;
  async function refresh() {
    if (!token) {root.innerHTML='<div class="card"><p>Connecting to your company records…</p><button class="secondary" id="overviewReconnect">Try again</button></div>';root.querySelector('button').onclick=()=>connect();return;}
    const current = ++sequence;
    const button=root.querySelector('#overviewRefresh');if(button){button.disabled=true;button.textContent='Refreshing…';}
    try {
      const [projectResponse, guaranteeResponse] = await Promise.all([api('/projects'),api('/guarantees')]);
      const logs = await Promise.all(projectResponse.data.map(p=>api('/site-logs/'+encodeURIComponent(p.id))));
      if(current!==sequence)return;
      const now = new Date();
      const today = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      render(summarize(projectResponse.data,guaranteeResponse.data,logs,today));
    } catch(error) {
      if(current!==sequence)return;
      root.innerHTML='<div class="card"><h2>Couldn’t load the overview</h2><p>Totals are unavailable. '+escape(error.message)+'</p><button class="secondary" id="overviewRetry">Try again</button></div>';
      root.querySelector('button').onclick=refresh;
    }
  }
  window.refreshExecutiveDashboard=refresh;
  const previousActivate = activateAppView;
  activateAppView = function(id){previousActivate(id);if(id==='dashboard')refresh();};
  refresh();
})();
