// Wrapper components to fix TypeScript issues with recharts and React 18
import * as RechartsOriginal from 'recharts'
import React from 'react'

// Type-safe wrapper for recharts components
export const ResponsiveContainer = RechartsOriginal.ResponsiveContainer as any
export const BarChart = RechartsOriginal.BarChart as any
export const Bar = RechartsOriginal.Bar as any
export const LineChart = RechartsOriginal.LineChart as any
export const Line = RechartsOriginal.Line as any
export const AreaChart = RechartsOriginal.AreaChart as any
export const Area = RechartsOriginal.Area as any
export const ScatterChart = RechartsOriginal.ScatterChart as any
export const Scatter = RechartsOriginal.Scatter as any
export const ComposedChart = RechartsOriginal.ComposedChart as any
export const PieChart = RechartsOriginal.PieChart as any
export const Pie = RechartsOriginal.Pie as any
export const Cell = RechartsOriginal.Cell as any
export const RadarChart = RechartsOriginal.RadarChart as any
export const Radar = RechartsOriginal.Radar as any
export const XAxis = RechartsOriginal.XAxis as any
export const YAxis = RechartsOriginal.YAxis as any
export const ZAxis = RechartsOriginal.ZAxis as any
export const CartesianGrid = RechartsOriginal.CartesianGrid as any
export const Tooltip = RechartsOriginal.Tooltip as any
export const Legend = RechartsOriginal.Legend as any
export const PolarGrid = RechartsOriginal.PolarGrid as any
export const PolarAngleAxis = RechartsOriginal.PolarAngleAxis as any
export const PolarRadiusAxis = RechartsOriginal.PolarRadiusAxis as any