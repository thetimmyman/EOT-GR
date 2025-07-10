/// <reference types="react" />

declare module 'recharts' {
  import { ComponentType, ReactElement } from 'react'
  
  // Re-export all recharts components with proper React 18 types
  export const ResponsiveContainer: ComponentType<any>
  export const BarChart: ComponentType<any>
  export const Bar: ComponentType<any>
  export const LineChart: ComponentType<any>
  export const Line: ComponentType<any>
  export const AreaChart: ComponentType<any>
  export const Area: ComponentType<any>
  export const ScatterChart: ComponentType<any>
  export const Scatter: ComponentType<any>
  export const ComposedChart: ComponentType<any>
  export const PieChart: ComponentType<any>
  export const Pie: ComponentType<any>
  export const Cell: ComponentType<any>
  export const RadarChart: ComponentType<any>
  export const Radar: ComponentType<any>
  export const XAxis: ComponentType<any>
  export const YAxis: ComponentType<any>
  export const ZAxis: ComponentType<any>
  export const CartesianGrid: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export const Legend: ComponentType<any>
  export const PolarGrid: ComponentType<any>
  export const PolarAngleAxis: ComponentType<any>
  export const PolarRadiusAxis: ComponentType<any>
}