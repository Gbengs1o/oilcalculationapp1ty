// src/app/components/GraphRenderer.tsx
'use client';

import React from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, ScatterChart, Scatter,
    AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, Cell
} from 'recharts';

// Type definition for the props
type GraphRendererProps = {
    type: string;
    data: any[]; // Expecting an array of objects
    options?: Record<string, any>; // Can be refined if options structure is known
    title?: string;
};

// Helper to safely get keys from an item, returning an empty array for non-objects/null
const safeGetKeys = (item: any): string[] => {
    if (typeof item === 'object' && item !== null) {
        return Object.keys(item);
    }
    // Keep the warning, it's useful
    console.warn("[GraphRenderer] safeGetKeys encountered non-object:", item);
    return [];
};

export default function GraphRenderer({ type, data, options = {}, title }: GraphRendererProps) {
    console.log("[GraphRenderer] Rendering:", { type, dataSize: data?.length, options, title });

    // 1. Initial Data Validation (Keep as is - looks good)
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("[GraphRenderer] Validation Failed: Invalid or empty graph data array.", { data });
        return (
            <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded text-sm">
                Invalid or empty graph data provided. Cannot render chart.
            </div>
        );
    }
    // It's good practice to ensure items are objects
    if (typeof data[0] !== 'object' || data[0] === null) {
         console.warn("[GraphRenderer] Validation Failed: Data items are not objects.", { firstItem: data[0] });
         return (
              <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded text-sm">
                  Graph data items must be objects. Cannot render chart.
              </div>
         );
     }

    const colors = [ '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#a4de6c', '#d0ed57', '#ff4d4d', '#4dffff', '#ffa64d', '#cc4dff', '#4d79ff', '#4dff4d' ];
    const chartHeight = typeof options?.height === 'number' && options.height > 50 ? options.height : 300;

    // --- REVISED Section 2: Dynamic Key Identification & Validation ---
    let categoryKey = ''; // Key used for X-axis labels (typically 'name')
    let dataKeys: string[] = []; // Keys for plotting values (Y-axis, area size, bar height etc.)
    let validationError: string | null = null;

    const firstItem = data[0]; // Already validated as an object
    const firstItemKeys = safeGetKeys(firstItem);
    const chartTypeLower = type?.toLowerCase() || 'unknown';

    try {
        if (firstItemKeys.length === 0 && chartTypeLower !== 'unknown') {
             // This case should ideally not happen due to prior validation, but good to keep.
            validationError = "Data objects have no keys.";
        } else {
            switch (chartTypeLower) {
                case 'pie':
                    // Pie is strict: requires 'name' and 'value'
                    if (!firstItem.hasOwnProperty('name') || !firstItem.hasOwnProperty('value')) {
                        validationError = "Pie chart data requires 'name' and 'value' properties.";
                    } else if (typeof firstItem.value !== 'number') {
                        validationError = "Pie chart 'value' property must be a number.";
                    } else {
                        categoryKey = 'name'; // Used by <Pie nameKey={categoryKey}>
                        dataKeys = ['value']; // Used by <Pie dataKey={dataKeys[0]}>
                    }
                    break;

                case 'scatter':
                    // Scatter is strict: requires 'x' and 'y' (numeric)
                    if (!firstItem.hasOwnProperty('x') || !firstItem.hasOwnProperty('y')) {
                        validationError = "Scatter chart data requires 'x' and 'y' properties.";
                    } else if (typeof firstItem.x !== 'number' || typeof firstItem.y !== 'number') {
                        validationError = "Scatter chart 'x' and 'y' values must be numbers.";
                    } else {
                        // For scatter, the keys are directly used in axes/scatter component props
                        // We don't strictly need categoryKey/dataKeys here, but can set for consistency if needed elsewhere
                        categoryKey = 'x'; // Conceptually the independent axis
                        dataKeys = ['y'];    // Conceptually the dependent axis
                    }
                    break;

                case 'line':
                case 'bar':
                case 'area':
                case 'composed':
                    // Common pattern: one 'name' key for category labels, others numeric for data
                    if (firstItem.hasOwnProperty('name')) {
                        categoryKey = 'name';
                    } else {
                        // Fallback: Try to find the *first* string key as category
                        categoryKey = firstItemKeys.find(key => typeof firstItem[key] === 'string') || '';
                        if (!categoryKey) {
                             validationError = `Could not identify a string category key (expected 'name' or similar) for '${type}'. Found keys: ${firstItemKeys.join(', ')}.`;
                             break; // Stop processing this case
                        }
                         console.warn(`[GraphRenderer] Using fallback category key '${categoryKey}' for ${type} chart (expected 'name').`);
                    }

                    // Find numeric data keys, excluding the identified category key
                    dataKeys = firstItemKeys.filter(key => key !== categoryKey && typeof firstItem[key] === 'number');

                    if (dataKeys.length === 0) {
                        validationError = `No numeric data keys found for '${type}' chart besides category '${categoryKey}'. Found keys: ${firstItemKeys.join(', ')}.`;
                    }

                    // Specific validation for 'composed' chart config
                    if (chartTypeLower === 'composed' && !validationError) { // Only validate if no prior error
                        if (!options?.chartConfig || !Array.isArray(options.chartConfig) || options.chartConfig.length === 0) {
                             validationError = "Composed chart requires 'options.chartConfig' array defining types and dataKeys.";
                        } else {
                            // Check if configured keys exist in the data and are among the identified numeric keys
                            const configuredKeys = options.chartConfig.map((c: any) => c?.dataKey).filter(Boolean);
                            if (configuredKeys.length === 0) {
                                validationError = "Composed 'chartConfig' lacks valid 'dataKey' definitions.";
                            } else {
                                const missingInData = configuredKeys.filter((k: string) => !firstItem.hasOwnProperty(k));
                                const nonNumeric = configuredKeys.filter((k: string) => firstItem.hasOwnProperty(k) && typeof firstItem[k] !== 'number'); //Check if configured keys are numeric

                                if (missingInData.length > 0) {
                                     validationError = `Composed configured dataKey(s) not found in data: ${missingInData.join(', ')}. Available keys: ${firstItemKeys.join(', ')}`;
                                } else if (nonNumeric.length > 0 && chartTypeLower !== 'composed') { // Allow non-numeric only if explicitly handled by composed config
                                     // This check might be too strict for composed if you intend to use non-numeric keys somehow, adjust if needed.
                                     // For standard line/bar/area generated from dataKeys, they MUST be numeric.
                                     // console.warn(`[GraphRenderer] Composed chart configured with non-numeric dataKey(s): ${nonNumeric.join(', ')}. Ensure components handle this.`);
                                }
                                // Ensure the identified numeric dataKeys cover the config (optional, but good sanity check)
                                // const unusedDataKeys = dataKeys.filter(dk => !configuredKeys.includes(dk));
                                // if (unusedDataKeys.length > 0) console.warn(`[GraphRenderer] Numeric data keys exist but are not used in composed config: ${unusedDataKeys.join(', ')}`)
                            }
                        }
                    }
                    break;

                default:
                    validationError = `Unsupported chart type: '${type}'. Supported: line, bar, pie, scatter, area, composed.`;
            }
        }
    } catch (err: any) {
        console.error("[GraphRenderer] Error during key ID/validation:", err);
        validationError = `Internal error processing chart data: ${err.message}`;
    }
    // --- END REVISED Section 2 ---


    // Log identified keys (Essential for debugging!)
    console.log(`[GraphRenderer] Keys Identified - Type: ${chartTypeLower}, Category Key ('${categoryKey}'), Data Keys: [${dataKeys.join(', ')}], Validation Error: ${validationError || 'None'}`);

    // 3. Render Title Helper (Keep as is)
    const renderTitle = () => title ? <h3 className="text-lg font-semibold text-center mb-3 text-slate-800 dark:text-slate-200">{title}</h3> : null;

    // 4. Return Validation Error if any (Keep as is)
    if (validationError) {
        console.warn("[GraphRenderer] Displaying validation error:", validationError);
        return (
            <div className="p-3 border border-yellow-400 bg-yellow-50 text-yellow-800 rounded text-sm">
                <strong>Chart Configuration Error:</strong> {validationError}
            </div>
        );
    }

    // 5. Render the Correct Chart (Reviewing props based on revised keys)
    const renderChart = () => {
        const tooltipStyle = { backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', padding: '8px 12px', borderRadius: '4px', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)', fontSize: '12px' };
        const axisStroke = "#6B7280"; // Tailwind gray-500
        const tickStyle = { fill: axisStroke, fontSize: 11 };
        const legendStyle = { fontSize: '12px', paddingTop: '10px', lineHeight: '1.5' };

        try {
            switch (chartTypeLower) {
                // **CHECK**: Ensure XAxis uses `categoryKey` correctly where applicable
                // **CHECK**: Ensure Line/Bar/Area/etc. use `dataKey` from the identified `dataKeys` array
                case 'line':
                    // Uses `categoryKey` for XAxis, iterates `dataKeys` for Lines. Looks OK.
                    return ( <ResponsiveContainer width="100%" height={chartHeight}><LineChart data={data} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700"/>
                        <XAxis dataKey={categoryKey} stroke={axisStroke} tick={tickStyle} interval={'preserveStartEnd'} />
                        <YAxis stroke={axisStroke} tick={tickStyle}/>
                        <Tooltip contentStyle={tooltipStyle}/>
                        <Legend wrapperStyle={legendStyle} />
                        {dataKeys.map((key, index) => ( <Line key={key} type={options?.lineType || "monotone"} dataKey={key} stroke={colors[index % colors.length]} activeDot={{ r: 6 }} name={options?.labels?.[key] || key} strokeWidth={2} dot={data.length < 50} connectNulls={options?.connectNulls ?? false} /> ))}
                    </LineChart></ResponsiveContainer> );
                case 'bar':
                    // Handles vertical layout correctly. Uses `categoryKey` for XAxis/YAxis (depending on layout), iterates `dataKeys` for Bars. Looks OK.
                     return ( <ResponsiveContainer width="100%" height={chartHeight}><BarChart data={data} margin={{ top: 5, right: 30, left: 5, bottom: 5 }} layout={options?.layout ?? 'horizontal'}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700"/>
                        {options?.layout === 'vertical' ? ( <> <XAxis type="number" stroke={axisStroke} tick={tickStyle}/> <YAxis dataKey={categoryKey} type="category" stroke={axisStroke} tick={tickStyle} width={options?.yAxisWidth ?? 80} interval={0} /> </> ) : ( <> <XAxis dataKey={categoryKey} stroke={axisStroke} tick={tickStyle} interval={options?.xAxisInterval ?? 'preserveStartEnd'}/> <YAxis stroke={axisStroke} tick={tickStyle}/> </> )}
                        <Tooltip contentStyle={tooltipStyle}/>
                        <Legend wrapperStyle={legendStyle} />
                        {dataKeys.map((key, index) => ( <Bar key={key} dataKey={key} fill={colors[index % colors.length]} name={options?.labels?.[key] || key} radius={options?.barRadius === undefined ? [4, 4, 0, 0] : options.barRadius} maxBarSize={options?.maxBarSize ?? 50} stackId={options?.stacked ? "stack1" : undefined} /> ))}
                     </BarChart></ResponsiveContainer> );
                case 'pie':
                    // Uses hardcoded 'name' and 'value' via nameKey/dataKey props. Independent of dynamic keys. Looks OK.
                    return ( <ResponsiveContainer width="100%" height={chartHeight}><PieChart margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
                        {/* Using categoryKey ('name') and dataKeys[0] ('value') here */}
                        <Pie data={data} cx="50%" cy="50%" labelLine={options?.labelLine ?? false} label={options?.label ?? (({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(0)}%)` : null)} outerRadius={options?.outerRadius ?? Math.min(chartHeight / 2.8, 110)} innerRadius={options?.innerRadius ?? 0} fill="#8884d8" dataKey={dataKeys[0]} nameKey={categoryKey} paddingAngle={options?.paddingAngle ?? (data.length > 1 ? 1 : 0)}>
                            {data.map((entry, index) => ( <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke={options?.cellStroke ?? '#fff'} strokeWidth={options?.innerRadius > 0 ? 1 : 0} /> ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle}/>
                        <Legend wrapperStyle={legendStyle}/>
                    </PieChart></ResponsiveContainer> );
                case 'scatter':
                    // Uses hardcoded 'x' and 'y' in axis/scatter props. Independent of dynamic keys. Looks OK.
                    return ( <ResponsiveContainer width="100%" height={chartHeight}><ScatterChart margin={{ top: 20, right: 30, left: 5, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700"/>
                        <XAxis dataKey="x" type="number" name={options?.xAxisLabel || 'X'} stroke={axisStroke} tick={tickStyle} domain={options?.xDomain ?? ['auto', 'auto']} />
                        <YAxis dataKey="y" type="number" name={options?.yAxisLabel || 'Y'} stroke={axisStroke} tick={tickStyle} domain={options?.yDomain ?? ['auto', 'auto']} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle}/>
                        <Legend wrapperStyle={legendStyle}/>
                        <Scatter name={options?.seriesName || 'Points'} data={data} fill={options?.scatterColor || colors[0]} shape={options?.shape || 'circle'}/>
                    </ScatterChart></ResponsiveContainer> );
                case 'area':
                    // Uses `categoryKey` for XAxis, iterates `dataKeys` for Areas. Looks OK.
                     return ( <ResponsiveContainer width="100%" height={chartHeight}><AreaChart data={data} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700"/>
                        <XAxis dataKey={categoryKey} stroke={axisStroke} tick={tickStyle}/>
                        <YAxis stroke={axisStroke} tick={tickStyle}/>
                        <Tooltip contentStyle={tooltipStyle}/>
                        <Legend wrapperStyle={legendStyle}/>
                        {dataKeys.map((key, index) => ( <Area key={key} type={options?.areaType || "monotone"} dataKey={key} stackId={options?.stacked ? "1" : undefined} stroke={colors[index % colors.length]} fillOpacity={options?.fillOpacity ?? 0.6} fill={colors[index % colors.length]} name={options?.labels?.[key] || key} connectNulls={options?.connectNulls ?? false} /> ))}
                     </AreaChart></ResponsiveContainer> );
                case 'composed':
                    // Uses `categoryKey` for XAxis. Uses `chartConfig` to iterate and render components, using `config.dataKey`. Looks OK, relies on chartConfig being correct.
                     return ( <ResponsiveContainer width="100%" height={chartHeight}><ComposedChart data={data} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700"/>
                        <XAxis dataKey={categoryKey} stroke={axisStroke} tick={tickStyle} />
                        <YAxis stroke={axisStroke} tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle}/>
                        <Legend wrapperStyle={legendStyle}/>
                         {options.chartConfig.map((config: any, index: number) => {
                             if (!config || !config.type || !config.dataKey || !firstItem.hasOwnProperty(config.dataKey)) { console.warn("[GraphRenderer] Invalid/missing item in composed chartConfig:", config); return <React.Fragment key={index}></React.Fragment>; }
                             const color = config.color || colors[index % colors.length];
                             const name = config.name || options?.labels?.[config.dataKey] || config.dataKey; // Use label from options if available
                             switch (config.type.toLowerCase()) {
                                 case 'bar': return <Bar key={`${config.dataKey}-${index}`} dataKey={config.dataKey} fill={color} name={name} radius={config.radius ?? options?.barRadius ?? [4, 4, 0, 0]} maxBarSize={options?.maxBarSize ?? 50} stackId={config.stackId ?? (options?.stacked ? "stack1" : undefined)} />;
                                 case 'line': return <Line key={`${config.dataKey}-${index}`} type={config.lineType ?? options?.lineType ?? "monotone"} dataKey={config.dataKey} stroke={color} name={name} strokeWidth={config.strokeWidth ?? 2} dot={data.length < 50} connectNulls={options?.connectNulls ?? false} activeDot={{ r: 6 }} />;
                                 case 'area': return <Area key={`${config.dataKey}-${index}`} type={config.areaType ?? options?.areaType ?? "monotone"} dataKey={config.dataKey} fill={color} stroke={color} name={name} fillOpacity={config.fillOpacity ?? options?.fillOpacity ?? 0.6} stackId={config.stackId ?? (options?.stacked ? "stack1" : undefined)} connectNulls={options?.connectNulls ?? false} />;
                                 default: console.warn(`Unsupported type '${config.type}' in composed config.`); return <React.Fragment key={index}></React.Fragment>;
                             }
                         })}
                     </ComposedChart></ResponsiveContainer> );
                 default:
                    // This case should not be reachable if validation passed.
                    console.error(`[GraphRenderer] Unexpected chart type in renderChart switch: ${type}`);
                    return <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded text-sm">Internal Error: Unexpected chart type '{type}'.</div>;
            }
        } catch (renderError: any) {
            // Keep the detailed render error logging
            console.error(`[GraphRenderer] !!! Recharts rendering error for type "${chartTypeLower}" !!!`, {
                errorMessage: renderError.message, errorStack: renderError.stack, dataSample: data.slice(0, 5), options, identifiedCategoryKey: categoryKey, identifiedDataKeys: dataKeys,
            });
             return ( <div className="p-3 border border-red-400 bg-red-100 text-red-800 rounded text-sm">
                     <strong>Chart Rendering Error!</strong> Failed to render the '{type}' chart. Check console. <small>Details: {renderError.message}</small>
                 </div> );
        }
    };

    // 6. Final component structure (Keep as is)
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mt-4 mb-2 overflow-hidden">
            {renderTitle()}
            <div style={{ width: '100%', height: chartHeight }} className="text-xs text-slate-700 dark:text-slate-300">
                {renderChart()}
            </div>
        </div>
    );
}