'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api.js';
import { TrendingUp, DollarSign, PieChart, ShoppingBag, AlertTriangle, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function ReportsPage() {
  const [dashboard, setDashboard] = useState(null);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [rangeSummary, setRangeSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    fetchRangeSummary(startDate, endDate);
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/reports/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRangeSummary = async (start, end) => {
    try {
      const res = await apiFetch(`/reports/range?startDate=${start}&endDate=${end}`);
      setRangeSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDate(val);
    fetchRangeSummary(val, endDate);
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setEndDate(val);
    fetchRangeSummary(startDate, val);
  };

  if (loading) return <div>Loading reports...</div>;

  const today = dashboard?.today || {};

  return (
    <>
      <style>{`
        .report-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        @media (max-width: 768px) {
          .report-section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .report-section-header input {
            width: 100% !important;
          }
        }
      `}</style>
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Profit & Sales Analytics</h1>
          <p style={styles.subtitle}>Historical FIFO profit breakdown & performance metrics</p>
        </div>
      </div>

      {/* Today KPI Grid */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard} className="card animate-fade-in">
          <div style={styles.kpiMeta}>
            <span>Today Sales Revenue</span>
            <DollarSign size={20} color="#b95117" />
          </div>
          <div style={styles.kpiValue}>₹{today.totalSales?.toFixed(2) || '0.00'}</div>
          <span style={styles.kpiSub}>Across {today.invoiceCount || 0} invoices</span>
        </div>

        <div style={styles.kpiCard} className="card animate-fade-in">
          <div style={styles.kpiMeta}>
            <span>Net Profit Earned</span>
            <TrendingUp size={20} color={today.totalProfit < 0 ? '#e11d48' : '#187653'} />
          </div>
          <div style={{ ...styles.kpiValue, color: today.totalProfit < 0 ? '#e11d48' : '#187653' }}>
            ₹{today.totalProfit?.toFixed(2) || '0.00'}
          </div>
          <span style={styles.kpiSub}>FIFO Cost Deducted</span>
        </div>

        <div style={styles.kpiCard} className="card animate-fade-in">
          <div style={styles.kpiMeta}>
            <span>Overall Margin %</span>
            <PieChart size={20} color="#a66b12" />
          </div>
          <div style={{ ...styles.kpiValue, color: '#a66b12' }}>
            {today.marginPercentage?.toFixed(1) || '0'}%
          </div>
          <span style={styles.kpiSub}>Profitability Margin</span>
        </div>
      </div>

      {/* Section: Custom Date Range Report */}
      <div style={styles.section} className="glass-panel">
        <div className="report-section-header">
          <h3><Calendar size={18} /> Date Range Report</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#536168', marginRight: '0.5rem' }}>From</label>
              <input
                type="date"
                className="input-control"
                style={{ width: '150px' }}
                value={startDate}
                onChange={handleStartDateChange}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#536168', marginRight: '0.5rem' }}>To</label>
              <input
                type="date"
                className="input-control"
                style={{ width: '150px' }}
                value={endDate}
                onChange={handleEndDateChange}
              />
            </div>
          </div>
        </div>

        {rangeSummary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Range KPI Row */}
            <div style={styles.dailyGrid}>
              <div style={styles.dailyItem}>
                <span>Period</span>
                <strong style={{ fontSize: '0.8rem' }}>{rangeSummary.startDate} <br/>to {rangeSummary.endDate}</strong>
              </div>
              <div style={styles.dailyItem}>
                <span>Total Sales</span>
                <strong style={{ color: '#b95117' }}>₹{rangeSummary.totalSales}</strong>
              </div>
              <div style={styles.dailyItem}>
                <span>Total Net Profit</span>
                <strong style={{ color: rangeSummary.totalProfit < 0 ? '#e11d48' : '#187653' }}>
                  ₹{rangeSummary.totalProfit}
                </strong>
              </div>
              <div style={styles.dailyItem}>
                <span>Avg Margin</span>
                <strong style={{ color: rangeSummary.totalProfit < 0 ? '#e11d48' : '#a66b12' }}>
                  {rangeSummary.marginPercentage}%
                </strong>
              </div>
              <div style={styles.dailyItem}>
                <span>Total Invoices</span>
                <strong>{rangeSummary.invoiceCount}</strong>
              </div>
            </div>

            {/* Range Bar Chart */}
            <div style={{ height: '350px', background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
              <h4 style={{ marginBottom: '1rem', color: '#1f2a2e' }}>Daily Performance Trend</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rangeSummary.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(tick) => tick.split('-')[2]} // Show just the day number
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12 }} 
                  />
                  <YAxis 
                    yAxisId="left"
                    orientation="left"
                    stroke="#b95117"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f6f6f2' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value, name) => {
                      // Custom formatter to show negatives in red if needed, 
                      // but default recharts tooltip shows it fine.
                      return [`₹${value}`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar yAxisId="left" dataKey="totalSales" name="Total Sales (₹)" fill="#b95117" radius={[4, 4, 0, 0]} />
                  <Bar 
                    yAxisId="left" 
                    dataKey="totalProfit" 
                    name="Net Profit (₹)" 
                    radius={[4, 4, 0, 0]} 
                  >
                    {
                      rangeSummary.dailyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.totalProfit < 0 ? '#e11d48' : '#187653'} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>



      {/* Widgets: Top Sellers & Low Stock */}
      <div style={styles.widgetGrid}>
        {/* Top Sellers */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} color="#f97316" /> Top Selling Items (In Range)
          </h3>
          <div style={styles.widgetList}>
            {(rangeSummary?.topSellers || dashboard?.topSellers)?.map((item) => (
              <div key={item.productId} style={styles.widgetRow}>
                <span>{item.productName}</span>
                <span className="badge badge-info">{item.totalQtySold} units sold</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Warnings */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="#f43f5e" /> Low Stock Alerts
          </h3>
          <div style={styles.widgetList}>
            {dashboard?.lowStock?.map((p) => (
              <div key={p.id} style={styles.widgetRow}>
                <div>
                  <div style={{ fontWeight: '700' }}>{p.nameEn}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.category}</div>
                </div>
                <span className="badge badge-danger">
                  {p.totalStock} units remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#536168',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.25rem',
  },
  kpiCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  kpiMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: '#536168',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#1f2a2e',
  },
  kpiSub: {
    fontSize: '0.78rem',
    color: '#64748b',
  },
  section: {
    padding: '1.25rem',
    borderRadius: '18px',
  },
  dailyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1rem',
    background: '#f6f6f2',
    padding: '1rem',
    borderRadius: '12px',
  },
  dailyItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    fontSize: '0.85rem',
  },
  widgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
  widgetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  widgetRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.8rem',
    background: '#f8f8f5',
    borderRadius: '8px',
    fontSize: '0.88rem',
  },
};
