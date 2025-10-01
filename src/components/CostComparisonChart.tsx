import React, { useMemo, useRef, useState } from 'react';
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
import zoomPlugin from 'chartjs-plugin-zoom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { UserInputs } from '../types/user';
import { PlanData } from '../types';
import { generateChartData, calculateUserSpending } from '../utils/chartDataGenerator';
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
  annotationPlugin,
  zoomPlugin
);

interface CostComparisonChartProps {
  planData: PlanData;
  userInputs: UserInputs;
}

const CostComparisonChart: React.FC<CostComparisonChartProps> = ({ planData, userInputs }) => {
  const currentSpending = calculateUserSpending(planData, userInputs);
  const chartRef = useRef<any>(null);
  const [zoomHistory, setZoomHistory] = useState<Array<{ min: number; max: number }>>([]);

  // Generate chart data and get max spending
  const { plans: chartPlans, maxSpending } = useMemo(
    () => generateChartData(planData, userInputs),
    [planData, userInputs]
  );

  const chartData = useMemo(() => {
    // Convert to Chart.js format with x,y coordinates
    // Use chart_color from plan data, fallback to gray if not specified
    const datasets = chartPlans.map(planChart => {
      // Find the corresponding plan to get its color
      const plan = planData.plans.find(p => p.name === planChart.planName);
      const color = plan?.chart_color || '#6b7280';

      return {
        label: planChart.planName,
        data: planChart.data.map(point => ({ x: point.spending, y: point.totalCost })),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 3,
        borderDash: planChart.dashed ? [8, 4] : undefined, // Dashed lines for PPO plans
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.1,
      };
    });

    return {
      datasets,
    };
  }, [chartPlans, planData]);

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
      label: {
        display: true,
        content: 'Your Spending',
        position: 'start',
        backgroundColor: '#4b5563',
        color: '#ffffff',
        font: {
          size: 11,
          weight: 'bold',
        },
      },
    };

    return annotationConfig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputs]);

  const options: ChartOptions<'line'> = useMemo(() => {
    // Use minimum of $500 for zoom calculations to ensure reasonable initial view
    const effectiveSpending = Math.max(500, currentSpending);
    const initialMaxX = effectiveSpending * 2;

    return {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          position: 'top',
          labels: {
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
          callbacks: {
            label: context => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: $${value.toLocaleString()}`;
            },
            title: tooltipItems => {
              const spending = tooltipItems[0].parsed.x;
              return `Healthcare Spending: $${spending.toLocaleString()}`;
            },
          },
        },
        annotation: {
          annotations,
        },
        zoom: {
          pan: {
            enabled: false, // Disable mouse panning
          },
          zoom: {
            wheel: {
              enabled: false, // Disable scroll zoom
            },
            pinch: {
              enabled: false, // Disable pinch zoom
            },
          },
          limits: {
            x: { min: 0, max: maxSpending }, // Limit zoom to actual data range
            // No Y-axis limits - let it scale automatically
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: initialMaxX, // Center user spending on initial view
          title: {
            display: true,
            text: 'Your Care Cost ($)',
            font: {
              size: 13,
              weight: 'bold',
            },
          },
          ticks: {
            callback: value => `$${Number(value).toLocaleString()}`,
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
            callback: value => `$${Number(value).toLocaleString()}`,
          },
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
    };
  }, [annotations, currentSpending, maxSpending]);

  const handleZoomIn = () => {
    if (chartRef.current && zoomHistory.length > 0) {
      const chart = chartRef.current;
      const previousZoom = zoomHistory[zoomHistory.length - 1];

      // Restore previous zoom level
      chart.zoomScale('x', { min: previousZoom.min, max: previousZoom.max }, 'default');

      // Remove from history
      setZoomHistory(prev => prev.slice(0, -1));
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      const chart = chartRef.current;
      const xScale = chart.scales.x;
      const currentMin = xScale.min;
      const currentMax = xScale.max;

      // Save current zoom to history before zooming out
      setZoomHistory(prev => [...prev, { min: currentMin, max: currentMax }]);

      const range = currentMax - currentMin;
      const newRange = range * 1.5; // Zoom out by 1.5x
      const center = (currentMin + currentMax) / 2;

      const newMin = Math.max(0, center - newRange / 2);
      const newMax = Math.min(maxSpending, center + newRange / 2);

      chart.zoomScale('x', { min: newMin, max: newMax }, 'default');
    }
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
      setZoomHistory([]); // Clear history on reset
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Cost Comparison Chart</h3>

      <div
        style={{
          marginBottom: '1rem',
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
            Each colored line shows how your total annual cost (premiums + out-of-pocket) changes as
            your healthcare spending increases
          </li>
          <li>
            <strong>Lower is better</strong> - choose the plan with the lowest line at your expected
            spending level
          </li>
          <li>
            The <span style={{ color: '#4b5563', fontWeight: 'bold' }}>dark gray dashed line</span>{' '}
            marks your current estimated spending ($
            {currentSpending.toLocaleString()})
          </li>
          <li>
            <strong>Zoom controls:</strong> Use the buttons below to zoom in/out or reset to your
            spending range
          </li>
          <li>
            <strong>PPO plans (dashed lines):</strong> These are forecasts based on your estimated
            service mix{' '}
            <HelpIcon
              title="Why PPO Forecasts Are Unpredictable"
              content={
                <div>
                  <p>
                    Unlike HSA plans where costs follow predictable deductible and coinsurance
                    rules, PPO plans have <strong>different copays for different services</strong>,
                    making your total out-of-pocket percentage highly dependent on what types of
                    care you receive.
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
                    The dashed PPO lines show projections based on <em>your</em> estimated service
                    mix, but your actual costs may vary depending on what care you actually need.
                  </p>
                  <p>
                    <strong>Important:</strong> If you don't enter a realistic mix of day-to-day
                    copay-based services (like office visits) and major coinsurance-based services
                    (like surgeries or imaging), the forecast line will be steeper or shallower than
                    reality. However, two points are always reliable:
                  </p>
                  <ul>
                    <li>
                      <strong>Starting point:</strong> Your annual premiums minus FSA tax savings
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

      <div style={{ padding: '1rem', position: 'relative' }}>
        {/* Zoom controls positioned at top right */}
        <div
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            display: 'flex',
            gap: '0.25rem',
            zIndex: 10,
          }}
        >
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              padding: '0.375rem',
              width: '2rem',
              height: '2rem',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Zoom"
            style={{
              padding: '0.375rem',
              width: '2rem',
              height: '2rem',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            <FontAwesomeIcon icon={faRotateLeft} />
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoomHistory.length === 0}
            title="Zoom In"
            style={{
              padding: '0.375rem',
              width: '2rem',
              height: '2rem',
              backgroundColor: zoomHistory.length === 0 ? '#f3f4f6' : 'white',
              color: zoomHistory.length === 0 ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.25rem',
              cursor: zoomHistory.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: zoomHistory.length === 0 ? 'none' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          </button>
        </div>

        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};

export default CostComparisonChart;
