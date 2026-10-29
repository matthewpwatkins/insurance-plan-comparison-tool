import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faRotateLeft,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { UserInputs } from '../types/user';
import { PlanData } from '../types';
import { generateChartData } from '../utils/chartDataGenerator';
import HelpIcon from './HelpIcon';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

interface CostComparisonChartProps {
  planData: PlanData;
  userInputs: UserInputs;
}

// Wait for typing to pause before redrawing, so the chart doesn't jump on every keystroke
/** Each zoom click shows this much less (or more) of the spending axis */
const ZOOM_STEP = 2;
/** Pixels left beyond the plot's edge for the arrowheads at the end of each line */
const ARROW_ROOM = 14;
/** Screens narrower than this get the phone layout */
const NARROW_WIDTH = 576;
/** The fully zoomed-out range ends on a multiple of this */
const FULL_RANGE_STEP = 5_000;
/** Zoomed views start and end on multiples of this */
const ZOOM_SNAP = 500;
/** Narrowest spending range the chart zooms in to */
const MIN_ZOOM_RANGE = 1_000;

const ZoomButton: React.FC<{
  title: string;
  icon: IconDefinition;
  disabled: boolean;
  onClick: () => void;
}> = ({ title, icon, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    style={{
      padding: '0.375rem',
      width: '2rem',
      height: '2rem',
      backgroundColor: disabled ? '#f3f4f6' : 'white',
      color: disabled ? '#9ca3af' : '#374151',
      border: '1px solid #d1d5db',
      borderRadius: '0.25rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: disabled ? 'none' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    }}
  >
    <FontAwesomeIcon icon={icon} />
  </button>
);

const REDRAW_DELAY_MS = 250;

const CostComparisonChart: React.FC<CostComparisonChartProps> = ({
  planData,
  userInputs: liveInputs,
}) => {
  const [userInputs, setUserInputs] = useState(liveInputs);
  useEffect(() => {
    const timer = setTimeout(() => setUserInputs(liveInputs), REDRAW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [liveInputs]);
  const chartRef = useRef<any>(null);

  const {
    plans: chartPlans,
    dots,
    userSpending: currentSpending,
    maxSpending,
  } = useMemo(() => generateChartData(planData, userInputs), [planData, userInputs]);

  // Visible spending range. Opens fully zoomed out; zooming centers on the user's spending.
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < NARROW_WIDTH);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < NARROW_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Full range ends on a round number, and zoomed views snap to whole steps
  const fullMax = Math.ceil(maxSpending / FULL_RANGE_STEP) * FULL_RANGE_STEP;
  const [view, setView] = useState({ min: 0, max: fullMax });
  useEffect(() => setView({ min: 0, max: fullMax }), [fullMax]);
  const zoomTo = (range: number) => {
    const snap = (value: number) => Math.round(value / ZOOM_SNAP) * ZOOM_SNAP;
    const width = Math.min(fullMax, Math.max(MIN_ZOOM_RANGE, snap(range)));
    const center = currentSpending > 0 ? currentSpending : (view.min + view.max) / 2;
    const min = Math.max(0, Math.min(snap(center - width / 2), fullMax - width));
    setView({ min, max: min + width });
  };
  const viewRange = view.max - view.min;
  const canZoomIn = viewRange > MIN_ZOOM_RANGE;
  const canZoomOut = viewRange < fullMax;
  const fullyZoomedOut = !canZoomOut;

  const chartData = useMemo(() => {
    // Convert to Chart.js format with x,y coordinates
    // Use chart_color from plan data, fallback to gray if not specified
    const colorOf = (planName: string) =>
      planData.plans.find(p => p.name === planName)?.chart_color || '#6b7280';

    // Fully zoomed out, every line has gone flat at its out-of-pocket max by the right edge.
    // There each line ends in a right-pointing arrow: its cost stays flat however high bills go.
    const lines = chartPlans.map(planChart => {
      const data = planChart.data.map(point => ({ x: point.spending, y: point.totalCost }));
      const last = data[data.length - 1];
      if (last && last.x < fullMax) data.push({ x: fullMax, y: last.y });
      const arrow = (context: { dataIndex?: number }) =>
        fullyZoomedOut && context.dataIndex === data.length - 1;
      return {
        label: planChart.planName,
        planName: planChart.planName,
        isDot: false,
        data,
        borderColor: colorOf(planChart.planName),
        backgroundColor: colorOf(planChart.planName),
        borderWidth: 3,
        pointRadius: (context: { dataIndex?: number }) => (arrow(context) ? 8 : 0),
        pointHoverRadius: (context: { dataIndex?: number }) => (arrow(context) ? 9 : 4),
        pointStyle: (context: { dataIndex?: number }) => (arrow(context) ? 'triangle' : 'circle'),
        pointRotation: (context: { dataIndex?: number }) => (arrow(context) ? 90 : 0),
        tension: 0, // Keep the bends at the deductible and out-of-pocket max sharp
        // Let the arrowheads draw past the plot's edge; zoomed in, lines stop at the edge
        clip: fullyZoomedOut ? { left: 0, top: ARROW_ROOM, right: ARROW_ROOM, bottom: 0 } : 0,
      };
    });

    // Each dot sits at the same x values as the lines (empty everywhere but the user's
    // spending), so hovering there lists every plan's line and dot together
    const xs = chartPlans[0]?.data.map(point => point.spending) ?? [];
    const dotSets = dots.map(dot => ({
      label: `${dot.planName} (your estimate)`,
      planName: dot.planName,
      isDot: true,
      data: xs.map(x => ({ x, y: x === dot.spending ? dot.totalCost : null })),
      borderColor: '#ffffff',
      backgroundColor: colorOf(dot.planName),
      borderWidth: 2,
      pointRadius: 7,
      pointHoverRadius: 8,
      showLine: false,
    }));

    return {
      datasets: [...lines, ...dotSets],
    };
  }, [chartPlans, dots, planData, fullMax, fullyZoomedOut]);

  const annotations = useMemo(() => {
    const annotationConfig: Record<string, any> = {};

    // Add green shaded area below y=0
    annotationConfig.greenShade = {
      type: 'box',
      yMin: -Infinity,
      yMax: 0,
      backgroundColor: 'rgba(34, 197, 94, 0.1)', // Light green with 10% opacity
      borderWidth: 0,
    };

    // Add current spending line (always show, even at zero)
    annotationConfig.currentSpending = {
      type: 'line',
      xMin: currentSpending,
      xMax: currentSpending,
      borderColor: '#4b5563',
      borderWidth: 2,
      borderDash: [5, 5],
    };

    // Speech bubble pointing at the top of the spending line
    annotationConfig.currentSpendingLabel = {
      type: 'label',
      xValue: currentSpending,
      yValue: ({ chart }: { chart: ChartJS }) => chart.scales.y.max,
      xAdjust: ({ chart }: { chart: ChartJS }) =>
        currentSpending > chart.scales.x.max * 0.7 ? -75 : 75,
      yAdjust: 25,
      content: 'Your Spending',
      backgroundColor: '#4b5563',
      color: '#ffffff',
      font: { size: 11, weight: 'bold' },
      padding: 6,
      borderRadius: 4,
      callout: {
        display: true,
        position: ({ chart }: { chart: ChartJS }) =>
          currentSpending > chart.scales.x.max * 0.7 ? 'right' : 'left',
        side: 8,
        margin: 0,
        borderColor: '#4b5563',
        borderWidth: 2,
        backgroundColor: '#4b5563',
      },
    };

    return annotationConfig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputs]);

  const options: ChartOptions<'line'> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: true,
      // Taller on phones so the lines aren't squashed
      aspectRatio: isNarrow ? 0.9 : 2,
      layout: { padding: { right: ARROW_ROOM, top: ARROW_ROOM } },
      plugins: {
        legend: {
          position: 'top',
          // One legend entry per plan; clicking it hides the plan's line and dot together
          onClick: (_event, legendItem, legend) => {
            const chart = legend.chart;
            const planName = (chart.data.datasets[legendItem.datasetIndex!] as any).planName;
            const hide = chart.isDatasetVisible(legendItem.datasetIndex!);
            chart.data.datasets.forEach((dataset, index) => {
              if ((dataset as any).planName === planName) {
                chart.setDatasetVisibility(index, !hide);
              }
            });
            chart.update();
          },
          labels: {
            filter: (legendItem, data) => !(data.datasets[legendItem.datasetIndex!] as any).isDot,
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              weight: 'bold',
            },
          },
        },
        title: {
          display: false, // Remove chart title, will add in HTML
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          filter: item => item.parsed.y !== null && !Number.isNaN(item.parsed.y),
          callbacks: {
            label: context => {
              const label = context.dataset.label || '';
              const value = Math.round(context.parsed.y);
              return `${label}: $${value.toLocaleString()}`;
            },
            title: tooltipItems => {
              const spending = tooltipItems[0].parsed.x;
              return `Medical bills: $${Math.round(spending).toLocaleString()}`;
            },
          },
        },
        annotation: {
          annotations,
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: view.min,
          max: view.max,
          title: {
            display: true,
            text: 'Your Medical Bills ($)',
            font: {
              size: 13,
              weight: 'bold',
            },
          },
          ticks: {
            callback: value => `$${Math.round(Number(value)).toLocaleString()}`,
          },
        },
        y: {
          title: {
            display: true,
            text: 'What You Pay ($)',
            font: {
              size: 13,
              weight: 'bold',
            },
          },
          ticks: {
            callback: value => `$${Math.round(Number(value)).toLocaleString()}`,
          },
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
    };
  }, [annotations, view, isNarrow]);

  // Show tooltip at user's spending point on initial load, except on phones where it would
  // cover most of the chart
  useEffect(() => {
    if (chartRef.current && chartPlans.length > 0 && !isNarrow) {
      const chart = chartRef.current;

      // Small delay to ensure chart is fully rendered
      const timer = setTimeout(() => {
        // Find the data point index closest to user's spending
        const firstPlanData = chartPlans[0].data;
        let closestIndex = 0;
        let minDiff = Math.abs(firstPlanData[0].spending - currentSpending);

        firstPlanData.forEach((point, index) => {
          const diff = Math.abs(point.spending - currentSpending);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = index;
          }
        });

        // Show tooltip at the closest point for all datasets
        if (chart.tooltip) {
          chart.tooltip.setActiveElements(
            chart.data.datasets.map((_: unknown, datasetIndex: number) => ({
              datasetIndex,
              index: closestIndex,
            })),
            { x: 0, y: 0 }
          );
          chart.update();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [chartPlans, currentSpending, isNarrow]);

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Cost Comparison Chart</h3>

      <div style={{ padding: isNarrow ? '0.5rem 0' : '1rem', position: 'relative' }}>
        {/* Zoom controls: over the chart's top right corner, or above the chart on phones */}
        <div
          style={
            isNarrow
              ? {
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.25rem',
                  marginBottom: '0.5rem',
                }
              : {
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  display: 'flex',
                  gap: '0.25rem',
                  zIndex: 10,
                }
          }
        >
          <ZoomButton
            title="Zoom out"
            icon={faMagnifyingGlassMinus}
            disabled={!canZoomOut}
            onClick={() => zoomTo(viewRange * ZOOM_STEP)}
          />
          <ZoomButton
            title="Show everything"
            icon={faRotateLeft}
            disabled={!canZoomOut}
            onClick={() => setView({ min: 0, max: fullMax })}
          />
          <ZoomButton
            title="Zoom in on your spending"
            icon={faMagnifyingGlassPlus}
            disabled={!canZoomIn}
            onClick={() => zoomTo(viewRange / ZOOM_STEP)}
          />
        </div>

        <Line ref={chartRef} data={chartData} options={options} />
      </div>

      <div
        style={{
          marginTop: '1rem',
          marginBottom: '3rem', // Keep it apart from the gray page footer
          padding: '0.75rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          color: '#4b5563',
        }}
      >
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>How to read this chart:</p>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>
            Each colored line shows how a plan's total annual cost (premiums + out-of-pocket) grows
            with your medical bills, and each dot is that plan's total for the care you entered
          </li>
          <li>
            <strong>Lower is better</strong> - your best plan has the lowest dot; the lines show how
            that could change if your bills run higher or lower
          </li>
          <li>
            The <span style={{ color: '#4b5563', fontWeight: 'bold' }}>dark gray dashed line</span>{' '}
            marks your medical bills (${Math.round(currentSpending).toLocaleString()})
          </li>
          <li>
            <strong>Dots and lines:</strong> Dots are your real totals. Lines show a typical bill,
            using your mix of copays once the deductible is met and split between people the way
            your care is. Free care and visit limits can put a dot above or below its line. The
            bottom axis leaves out care that is free on every plan and costs insurance doesn't
            cover, which raise every line by the same amount
          </li>
          <li>
            <strong>PPO plans are an approximation:</strong> Until the deductible is met, a visit
            costs its full bill; after that, just the copay. So when your care happens changes what
            you pay. We spread each of your estimates evenly across the year. If your care bunches
            up early or late in the year, your real cost on a PPO plan can be a bit higher or lower.
            This is also why a PPO plan's dot can sit above or below its line
          </li>
          <li>
            <strong>Zoom controls:</strong> Zoom in on your spending, zoom back out, or show
            everything
          </li>
          <li>
            <strong>Bends in the lines:</strong> You pay all of your bills until you meet the
            deductible, then the plan's share for your mix of care, and nothing more once you reach
            the out-of-pocket maximum{' '}
            <HelpIcon
              title="Why Your Service Mix Matters"
              content={
                <div>
                  <p>
                    Plans charge <strong>different copays for different services</strong>, so your
                    total out-of-pocket percentage depends heavily on what types of care you
                    receive.
                  </p>
                  <p>
                    <strong>Example:</strong> Suppose two identical people—Fred and Phil—both enroll
                    in the PPO 90 plan, and they both incur exactly $7,500 in medical costs
                    throughout the year.
                  </p>
                  <ul>
                    <li>
                      <strong>Fred's care:</strong> 25 chiropractor visits + 25 physical therapy
                      visits at $150 each. He pays a $35 copay at each visit, totaling{' '}
                      <strong>$1,750 out-of-pocket</strong>.
                    </li>
                    <li>
                      <strong>Phil's care:</strong> One $7,500 surgery, of which he pays 10%
                      coinsurance = <strong>$750 out-of-pocket</strong>.
                    </li>
                  </ul>
                  <p>
                    They both received $7,500 in healthcare during the year, but{' '}
                    <strong>Fred paid more than double what Phil paid</strong> due to the different
                    service mix.
                  </p>
                  <p>
                    After the deductible, each line blends in the copays for the care you entered.
                    Your dots use your exact care, so a dot can still sit above or below its line
                    (copays before the deductible, free care, visit limits). Either way, two points
                    on every line are reliable:
                  </p>
                  <ul>
                    <li>
                      <strong>Starting point:</strong> Your annual premiums minus HSA/FSA tax
                      savings and any employer contribution
                    </li>
                    <li>
                      <strong>Flatline (end point):</strong> Your worst-case maximum annual cost
                    </li>
                  </ul>
                  <p>
                    The slope between these points depends on your service mix—it's just a question
                    of <em>how fast</em> you hit your out-of-pocket maximum, not <em>if</em> you'll
                    hit it at high spending levels.
                  </p>
                </div>
              }
            />
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CostComparisonChart;
