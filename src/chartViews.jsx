import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const card=(K)=>({background:K.cd,borderRadius:14,border:"1px solid "+K.bd,padding:16});
const ct=(K)=>({fontSize:10,color:K.dm,letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:8});
const kFmt=v=>"$"+(Math.abs(v)/1000).toFixed(0)+"k";

export function DashboardCharts({ histSeries, savHist, K, tt, fmt, g2 }){
  return(
    <>
      <div style={{...card(K),marginBottom:12}}>
        <div style={ct(K)}>Net Worth & Income Trajectory</div>
        <div style={{display:"grid",gridTemplateColumns:g2,gap:10}}>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={histSeries.map(item=>({name:item.m,nw:(item.sav+item.ira+item.stk+item.jnt/2)-item.loans}))}>
              <defs>
                <linearGradient id="dashNw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={K.ac} stopOpacity={0.4}/>
                  <stop offset="100%" stopColor={K.ac} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={3}/>
              <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={v=>(v>=0?"$":"-$")+(Math.abs(v)/1000).toFixed(0)+"k"}/>
              <Tooltip contentStyle={tt} formatter={v=>[fmt(v),"Net Worth"]}/>
              <Area type="monotone" dataKey="nw" stroke={K.ac} strokeWidth={2} fill="url(#dashNw)"/>
            </AreaChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={histSeries.map(item=>({name:item.m,inc:item.inc,fix:item.fix,spend:item.spend}))}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={3}/>
              <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={v=>"$"+(v/1000).toFixed(1)+"k"}/>
              <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
              <Line type="monotone" dataKey="inc" stroke={K.ac} strokeWidth={2} dot={false} name="Income"/>
              <Line type="monotone" dataKey="spend" stroke={K.dn} strokeWidth={1.5} dot={false} name="Spend" strokeDasharray="4 2"/>
              <Line type="monotone" dataKey="fix" stroke={K.wn} strokeWidth={1} dot={false} name="Fixed" opacity={0.5}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:g2,gap:10,marginBottom:12}}>
        <div style={card(K)}>
          <div style={ct(K)}>Savings Rate Trend</div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={savHist}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={3}/>
              <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={v=>v+"%"}/>
              <Tooltip contentStyle={tt} formatter={v=>[v.toFixed(1)+"%"]}/>
              <Line type="monotone" dataKey="rate" stroke={K.ac} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={card(K)}>
          <div style={ct(K)}>Income vs Spend</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={histSeries.slice(-8).map(item=>({name:item.m,inc:item.inc,out:item.spend+item.fix}))} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}}/>
              <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={v=>"$"+(v/1000).toFixed(0)+"k"}/>
              <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
              <Bar dataKey="inc" fill={K.ac} radius={[3,3,0,0]} barSize={10}/>
              <Bar dataKey="out" fill={K.dn} radius={[3,3,0,0]} barSize={10} opacity={0.6}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export function SavingsGrowthChart({ histSeries, K, tt, fmt }){
  return(
    <div style={card(K)}>
      <div style={ct(K)}>IRA Growth</div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={histSeries.filter(item=>item.ira>0).map(item=>({name:item.m,v:item.ira}))}>
          <defs>
            <linearGradient id="savingsIra" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={K.pp} stopOpacity={0.3}/>
              <stop offset="100%" stopColor={K.pp} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
          <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}}/>
          <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={v=>"$"+(v/1000).toFixed(1)+"k"}/>
          <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
          <Area type="monotone" dataKey="v" stroke={K.pp} strokeWidth={2} fill="url(#savingsIra)"/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DebtPayoffChart({ points, K, tt, fmt, chartId }){
  return(
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={points}>
        <defs>
          <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={K.ac} stopOpacity={0.3}/>
            <stop offset="100%" stopColor={K.ac} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
        <XAxis dataKey="label" tick={{fontSize:7,fill:K.dm}}/>
        <YAxis tick={{fontSize:7,fill:K.dm}} tickFormatter={v=>fmt(v)}/>
        <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
        <Area type="monotone" dataKey="rem" stroke={K.ac} strokeWidth={2} fill={`url(#${chartId})`}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CreditTrendChart({ scores, K, tt }){
  return(
    <div style={{...card(K),marginBottom:12}}>
      <div style={ct(K)}>Trend</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={scores.map(score=>({name:score.date,score:score.score}))}>
          <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
          <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}}/>
          <YAxis domain={["auto","auto"]} tick={{fontSize:8,fill:K.dm}}/>
          <Tooltip contentStyle={tt}/>
          <Line type="monotone" dataKey="score" stroke={K.ac} strokeWidth={2} dot={{fill:K.ac,r:3}}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportCharts({ rangeReport, K, tt, fmt }){
  return(
    <div style={{...card(K),marginBottom:12}}>
      <div style={ct(K)}>Range Spend vs Budget</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rangeReport.cg.map(item=>({name:item.n,spent:item.spent,budget:item.budget}))}>
          <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
          <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={0} angle={-18} textAnchor="end" height={48}/>
          <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={v=>"$"+(v/1000).toFixed(0)+"k"}/>
          <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
          <Bar dataKey="budget" fill={K.bl} opacity={0.35} radius={[3,3,0,0]}/>
          <Bar dataKey="spent" fill={K.ac} radius={[3,3,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetWorthView({ histSeries, accountHistory, K, tt, fmt, mob }){
  const nwData=histSeries.map(item=>({name:item.m,nw:(item.sav+item.ira+item.stk+item.jnt/2)-item.loans,sav:item.sav,ira:item.ira,stk:item.stk,jnt:item.jnt/2,debt:item.loans}));
  const milestones=[];
  let crossed0=false,crossed10k=false,crossed20k=false;
  nwData.forEach(item=>{
    if(!crossed0&&item.nw>=0){crossed0=true;milestones.push({m:item.name,l:"Net Positive",v:item.nw})}
    if(!crossed10k&&item.nw>=10000){crossed10k=true;milestones.push({m:item.name,l:"$10K Club",v:item.nw})}
    if(!crossed20k&&item.nw>=20000){crossed20k=true;milestones.push({m:item.name,l:"$20K Mark",v:item.nw})}
  });
  const peakNW=Math.max(...nwData.map(item=>item.nw));
  const firstNW=nwData[0]?.nw||0;
  const curNW=nwData[nwData.length-1]?.nw||0;
  const totalGain=curNW-firstNW;
  const avgGain=totalGain/Math.max(1,nwData.length);
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[{label:"Current NW",value:fmt(curNW),color:K.ac},{label:"Total Gain",value:fmt(totalGain),color:totalGain>=0?K.ac:K.dn},{label:"Avg / Month",value:fmt(avgGain),color:K.bl},{label:"Peak",value:fmt(peakNW),color:K.pp}].map(item=>(
          <div key={item.label} style={card(K)}>
            <div style={ct(K)}>{item.label}</div>
            <div style={{fontSize:26,fontWeight:800,color:item.color,letterSpacing:-0.8}}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={card(K)}>
        <div style={ct(K)}>Net Worth Over Time</div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={nwData}>
            <defs>
              <linearGradient id="netWorthMain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={K.ac} stopOpacity={0.4}/>
                <stop offset="100%" stopColor={K.ac} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
            <XAxis dataKey="name" tick={{fontSize:9,fill:K.dm}}/>
            <YAxis tick={{fontSize:9,fill:K.dm}} tickFormatter={kFmt}/>
            <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
            <Area type="monotone" dataKey="nw" stroke={K.ac} strokeWidth={2.5} fill="url(#netWorthMain)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {milestones.length>0&&<div style={{...card(K),marginTop:12}}>
        <div style={ct(K)}>Milestones</div>
        {milestones.map(item=>(
          <div key={item.l+item.m} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+K.bd,fontSize:11}}>
            <span style={{fontWeight:700}}>{item.l}</span>
            <span style={{color:K.mt}}>{item.m} · {fmt(item.v)}</span>
          </div>
        ))}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1.1fr .9fr",gap:12,marginTop:12}}>
        <div style={card(K)}>
          <div style={ct(K)}>Asset Breakdown</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={nwData}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={2}/>
              <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={kFmt}/>
              <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
              <Area type="monotone" dataKey="sav" stackId="1" stroke={K.bl} fill={K.bl+"40"} name="Savings"/>
              <Area type="monotone" dataKey="ira" stackId="1" stroke={K.pp} fill={K.pp+"40"} name="IRA"/>
              <Area type="monotone" dataKey="stk" stackId="1" stroke={K.ac} fill={K.ac+"40"} name="Stocks"/>
              <Area type="monotone" dataKey="jnt" stackId="1" stroke={K.wn} fill={K.wn+"40"} name="Joint"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={card(K)}>
          <div style={ct(K)}>Account-Level History</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={accountHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={2}/>
              <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={kFmt}/>
              <Tooltip contentStyle={tt} formatter={v=>[fmt(v)]}/>
              <Line type="monotone" dataKey="cash" stroke={K.ac} strokeWidth={2} dot={false} name="Tracked Cash"/>
              <Line type="monotone" dataKey="debit" stroke={K.bl} strokeWidth={1.5} dot={false} name="Debit Spend" strokeDasharray="4 2"/>
              <Line type="monotone" dataKey="chase" stroke={K.wn} strokeWidth={1.5} dot={false} name="Chase Spend" strokeDasharray="4 2"/>
              <Line type="monotone" dataKey="capitalone" stroke={K.pp} strokeWidth={1.5} dot={false} name="CapOne Spend" strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{fontSize:10,color:K.mt,marginTop:8,lineHeight:1.5}}>
            Cash is estimated backward from current balances plus imported monthly activity so range history still works before you have manual balance snapshots.
          </div>
        </div>
      </div>
      <div style={{...card(K),marginTop:12}}>
        <div style={ct(K)}>Debt Paydown</div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={nwData}>
            <defs>
              <linearGradient id="netWorthDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={K.dn} stopOpacity={0.3}/>
                <stop offset="100%" stopColor={K.dn} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={K.bd}/>
            <XAxis dataKey="name" tick={{fontSize:8,fill:K.dm}} interval={2}/>
            <YAxis tick={{fontSize:8,fill:K.dm}} tickFormatter={kFmt}/>
            <Tooltip contentStyle={tt} formatter={v=>[fmt(v),"Remaining"]}/>
            <Area type="monotone" dataKey="debt" stroke={K.dn} strokeWidth={2} fill="url(#netWorthDebt)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
