'use client'

import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts'

interface SalesChartProps {
  // Key diubah menjadi 'penjualan' agar sinkron dengan Dashboard
  data: { date: string; penjualan: number; profit: number }[]
}

export function SalesChart({ data }: SalesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        Belum ada data penjualan
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {/* Gradien Biru untuk Penjualan */}
          <linearGradient id="colorPenjualan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          {/* Gradien Hijau untuk Profit */}
          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        
        <XAxis 
          dataKey="date" 
          stroke="#888888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="#888888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `Rp${(value / 1000).toFixed(0)}k`}
        />
        
        <Tooltip 
          cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
          formatter={(value: number, name: string) => [
            new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
            }).format(value),
            name === 'penjualan' ? 'Penjualan' : 'Profit'
          ]}
          contentStyle={{
            backgroundColor: 'white',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          }}
        />
        
        <Legend 
          verticalAlign="top" 
          align="right"
          height={40}
          iconType="circle"
          formatter={(value) => (
            <span className="text-xs font-medium text-slate-600 capitalize">
              {value === 'penjualan' ? 'Penjualan' : 'Profit'}
            </span>
          )}
        />

        <Area
          type="monotone"
          dataKey="penjualan"
          stroke="#3b82f6"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorPenjualan)"
          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        
        <Area
          type="monotone"
          dataKey="profit"
          stroke="#10b981"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorProfit)"
          dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}