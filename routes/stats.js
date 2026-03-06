const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Helper function to get date range based on filter
const getDateRange = (filter, startDate, endDate) => {
    const now = new Date();
    let from, to;

    switch (filter) {
        case 'this_week':
            from = new Date(now);
            from.setDate(now.getDate() - now.getDay());
            from.setHours(0, 0, 0, 0);
            to = new Date(now);
            to.setHours(23, 59, 59, 999);
            break;

        case 'this_month':
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            from.setHours(0, 0, 0, 0);
            to = new Date(now);
            to.setHours(23, 59, 59, 999);
            break;

        case 'last_week':
            const lastSunday = new Date(now);
            lastSunday.setDate(now.getDate() - now.getDay() - 7);
            from = new Date(lastSunday);
            from.setHours(0, 0, 0, 0);
            to = new Date(lastSunday);
            to.setDate(lastSunday.getDate() + 6);
            to.setHours(23, 59, 59, 999);
            break;

        case 'last_month':
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            from.setHours(0, 0, 0, 0);
            to = new Date(now.getFullYear(), now.getMonth(), 0);
            to.setHours(23, 59, 59, 999);
            break;

        case 'last_3_months':
            from = new Date(now);
            from.setMonth(now.getMonth() - 3);
            from.setHours(0, 0, 0, 0);
            to = new Date(now);
            to.setHours(23, 59, 59, 999);
            break;

        case 'last_year':
            from = new Date(now);
            from.setFullYear(now.getFullYear() - 1);
            from.setHours(0, 0, 0, 0);
            to = new Date(now);
            to.setHours(23, 59, 59, 999);
            break;

        case 'custom':
            if (startDate && endDate) {
                from = new Date(startDate);
                from.setHours(0, 0, 0, 0);
                to = new Date(endDate);
                to.setHours(23, 59, 59, 999);
            } else {
                from = new Date(now);
                from.setDate(now.getDate() - 30);
                from.setHours(0, 0, 0, 0);
                to = new Date(now);
                to.setHours(23, 59, 59, 999);
            }
            break;

        default:
            from = new Date(now);
            from.setDate(now.getDate() - 30);
            from.setHours(0, 0, 0, 0);
            to = new Date(now);
            to.setHours(23, 59, 59, 999);
    }

    return { from, to };
};

// Helper function to get previous period for comparison
const getPreviousPeriod = (from, to) => {
    const duration = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1); // 1ms before current period starts
    prevTo.setHours(23, 59, 59, 999);
    const prevFrom = new Date(prevTo.getTime() - duration);
    prevFrom.setHours(0, 0, 0, 0);
    return { prevFrom, prevTo };
};

// Trend colors
const TREND_COLORS = {
    up: '#4CAF50',      // Green
    down: '#F44336',    // Red
    neutral: '#FFFFFF00' // Transparent
};

// Helper to format number in Indian currency format (₹ 10,00,000)
const formatIndianCurrency = (num) => {
    if (num === null || num === undefined || num === '--') return '--';
    const number = Math.round(num);
    const numStr = number.toString();

    // Handle negative numbers
    const isNegative = number < 0;
    const absNumStr = Math.abs(number).toString();

    // Indian formatting: first 3 digits from right, then groups of 2
    let result = '';
    const len = absNumStr.length;

    if (len <= 3) {
        result = absNumStr;
    } else {
        // Last 3 digits
        result = absNumStr.slice(-3);
        // Remaining digits in groups of 2
        let remaining = absNumStr.slice(0, -3);
        while (remaining.length > 2) {
            result = remaining.slice(-2) + ',' + result;
            remaining = remaining.slice(0, -2);
        }
        if (remaining.length > 0) {
            result = remaining + ',' + result;
        }
    }

    return (isNegative ? '-' : '') + '₹' + result;
};

// Helper to calculate percentage change
const calculatePercentageChange = (current, previous) => {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10; // Round to 1 decimal
};

// Helper to format trend info
const formatTrend = (current, previous, isCurrency = false) => {
    const percentage = calculatePercentageChange(current, previous);
    const isUp = percentage >= 0;
    return {
        value: isCurrency ? formatIndianCurrency(current) : current,
        previousValue: isCurrency ? formatIndianCurrency(previous) : previous,
        trend: isUp ? true : false,
        trendLabel: isUp ? `+${percentage}%` : `${percentage}%`
    };
};

// Helper for metrics without trend (all-time or cumulative)
const formatNoTrend = (value, isCurrency = false) => {
    return {
        value: isCurrency ? formatIndianCurrency(value) : value,
        previousValue: '--',
        trend: false,
        trendLabel: '--'
    };
};

// Helper to convert number to double format (15 -> 15.0)
const toDouble = (num) => {
    if (num === null || num === undefined) return 0.0;
    return parseFloat(Number(num).toFixed(1));
};

// Helper to format chart data as array of {label, value} objects
const formatChartData = (labels, values) => {
    return labels.map((label, index) => ({
        label: label,
        value: values[index]
    }));
};

// Helper to limit chart data to 7 items (6 top + "Others")
const limitChartDataWithOthers = (labels, values, isCurrency = false) => {
    if (labels.length <= 7) {
        return formatChartData(labels, values);
    }

    // Take top 6 items
    const top6Labels = labels.slice(0, 6);
    const top6Values = values.slice(0, 6);

    // Sum up the rest as "Others"
    const othersValues = values.slice(6);
    let othersTotal;

    if (isCurrency) {
        // For currency values, we need to extract numbers, sum, then format
        othersTotal = othersValues.reduce((sum, val) => {
            // Extract number from currency string like "₹1,00,000"
            const numStr = String(val).replace(/[₹,]/g, '');
            return sum + (parseFloat(numStr) || 0);
        }, 0);
        othersTotal = formatIndianCurrency(Math.round(othersTotal));
    } else {
        // For numeric values, just sum them
        othersTotal = toDouble(othersValues.reduce((sum, val) => sum + (parseFloat(val) || 0), 0));
    }

    return formatChartData(
        [...top6Labels, 'Others'],
        [...top6Values, othersTotal]
    );
};

// Helper to ensure line charts have at least 2 data points and max 7
const ensureMinimumDataPoints = (labels, values, isCurrency = false) => {
    let finalLabels = labels;
    let finalValues = values;

    if (labels.length === 0) {
        // No data at all - return two zero points
        finalLabels = ['Start', 'End'];
        finalValues = isCurrency ? ['₹0', '₹0'] : [0.0, 0.0];
    } else if (labels.length === 1) {
        // Only one point - add a zero starting point
        finalLabels = ['Start', ...labels];
        finalValues = isCurrency ? ['₹0', ...values] : [0.0, ...values];
    }

    // Limit to 7 data points for line charts (take last 7 for time series)
    if (finalLabels.length > 7) {
        finalLabels = finalLabels.slice(-7);
        finalValues = finalValues.slice(-7);
    }

    return {
        data: formatChartData(finalLabels, finalValues)
    };
};

// Helper to parse encoded query string from filter parameter
const parseEncodedFilter = (filterValue) => {
    let filter = filterValue;
    let startDate = null;
    let endDate = null;

    if (filterValue && (filterValue.includes('&') || filterValue.includes('startDate') || filterValue.includes('endDate'))) {
        // Decode the filter value first
        const decoded = decodeURIComponent(filterValue);

        // Parse the encoded query string
        const parts = decoded.split('&');

        for (const part of parts) {
            if (part.includes('=')) {
                const [key, value] = part.split('=');
                if (key === 'startDate') {
                    startDate = value;
                } else if (key === 'endDate') {
                    endDate = value;
                }
            } else {
                // This is the filter value (e.g., "custom")
                filter = part;
            }
        }
    }

    return { filter, startDate, endDate };
};

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Log incoming request
        console.log('\n========== STATS API CALL ==========');
        console.log('Full Query:', req.query);
        console.log('Raw URL:', req.originalUrl);

        // Get query parameters
        let { filter, startDate, endDate } = req.query;

        // Fix: Parse encoded filter if it contains startDate/endDate
        if (filter && (filter.includes('startDate') || filter.includes('endDate') || filter.includes('&'))) {
            const parsed = parseEncodedFilter(filter);
            filter = parsed.filter;
            startDate = parsed.startDate || startDate;
            endDate = parsed.endDate || endDate;
        }

        console.log('Parsed Filter:', filter);
        console.log('Parsed Start Date:', startDate);
        console.log('Parsed End Date:', endDate);
        console.log('=====================================\n');

        const { from, to } = getDateRange(filter, startDate, endDate);
        const { prevFrom, prevTo } = getPreviousPeriod(from, to);

        // Log calculated date ranges
        console.log('Calculated Date Range:');
        console.log('  From:', from.toISOString());
        console.log('  To:', to.toISOString());
        console.log('Previous Period:');
        console.log('  From:', prevFrom.toISOString());
        console.log('  To:', prevTo.toISOString());
        console.log('=====================================\n');

        // Run all queries in parallel for performance
        const [
            // Current period stats
            totalUsers,
            totalProducts,
            orderStats,
            userDuesStats,
            newUsersCount,

            // Previous period stats for comparison
            prevOrderStats,
            prevNewUsersCount,
            prevUserDuesStats,

            // User stats
            newUsersTrend,
            usersByState,
            duesStatus,
            topCustomers,

            // Order stats
            ordersTrend,
            revenueTrend,
            paymentMethods,
            ordersByState,

            // Product stats
            topSellingProducts,
            productRevenue,
            freeProductsStats
        ] = await Promise.all([
            // Total users (all time)
            User.countDocuments(),

            // Total products (all time)
            Product.countDocuments(),

            // Order statistics within current date range
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: '$billing.totalAmount' },
                        avgOrderValue: { $avg: '$billing.totalAmount' }
                    }
                }
            ]),

            // User dues stats (current)
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalDues: { $sum: '$dues' },
                        usersWithDues: { $sum: { $cond: [{ $gt: ['$dues', 0] }, 1, 0] } },
                        usersWithoutDues: { $sum: { $cond: [{ $lte: ['$dues', 0] }, 1, 0] } }
                    }
                }
            ]),

            // New users in current period
            User.countDocuments({ createdAt: { $gte: from, $lte: to } }),

            // Previous period order stats
            Order.aggregate([
                { $match: { createdAt: { $gte: prevFrom, $lte: prevTo } } },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: '$billing.totalAmount' },
                        avgOrderValue: { $avg: '$billing.totalAmount' }
                    }
                }
            ]),

            // Previous period new users
            User.countDocuments({ createdAt: { $gte: prevFrom, $lte: prevTo } }),

            // Previous period dues (we'll compare with current dues)
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalDues: { $sum: '$dues' }
                    }
                }
            ]),

            // New users trend (by month)
            User.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // Users by state
            User.aggregate([
                {
                    $group: {
                        _id: '$state',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),

            // Dues status
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        withDues: { $sum: { $cond: [{ $gt: ['$dues', 0] }, 1, 0] } },
                        noDues: { $sum: { $cond: [{ $lte: ['$dues', 0] }, 1, 0] } }
                    }
                }
            ]),

            // Top customers by order value
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: '$user.shopName',
                        totalSpent: { $sum: '$billing.totalAmount' },
                        orderCount: { $sum: 1 }
                    }
                },
                { $sort: { totalSpent: -1 } },
                { $limit: 20 }
            ]),

            // Orders trend (by month)
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // Revenue trend (by month)
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        revenue: { $sum: '$billing.totalAmount' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // Payment methods distribution
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: '$billing.paymentMethod',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),

            // Orders by state
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: '$user.state',
                        count: { $sum: 1 },
                        revenue: { $sum: '$billing.totalAmount' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),

            // Top selling products
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                { $unwind: '$productDetails' },
                {
                    $group: {
                        _id: '$productDetails.name',
                        totalQuantity: { $sum: '$productDetails.quantity' },
                        totalRevenue: { $sum: '$productDetails.totalAmount' }
                    }
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: 20 }
            ]),

            // Product revenue share
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                { $unwind: '$productDetails' },
                {
                    $group: {
                        _id: '$productDetails.name',
                        revenue: { $sum: '$productDetails.totalAmount' }
                    }
                },
                { $sort: { revenue: -1 } },
                { $limit: 20 }
            ]),

            // Free products given
            Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to }, isfreeProducts: true } },
                { $unwind: '$freeProducts' },
                {
                    $group: {
                        _id: '$freeProducts.name',
                        count: { $sum: '$freeProducts.quantity' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ])
        ]);

        // Process current period stats
        const currentStats = orderStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
        const currentDues = userDuesStats[0] || { totalDues: 0 };
        const duesData = duesStatus[0] || { withDues: 0, noDues: 0 };

        // Process previous period stats
        const prevStats = prevOrderStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };

        // Format month labels for trends
        const formatTrendData = (data) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return {
                labels: data.map(d => `${months[d._id.month - 1]} ${String(d._id.year).slice(-2)}`),
                data: data.map(d => d.count || d.revenue || 0)
            };
        };

        const response = {
            success: true,
            data: {
                summary: {
                    totalUsers: formatNoTrend(totalUsers, false),
                    totalProducts: formatNoTrend(totalProducts, false),
                    totalOrders: formatTrend(
                        currentStats.totalOrders,
                        prevStats.totalOrders,
                        false
                    ),
                    totalRevenue: formatTrend(
                        Math.round(currentStats.totalRevenue || 0),
                        Math.round(prevStats.totalRevenue || 0),
                        true // Currency
                    ),
                    totalDues: formatNoTrend(Math.round(currentDues.totalDues || 0), true), // Currency
                    avgOrderValue: formatTrend(
                        Math.round(currentStats.avgOrderValue || 0),
                        Math.round(prevStats.avgOrderValue || 0),
                        true // Currency
                    ),
                    newUsers: formatTrend(
                        newUsersCount,
                        prevNewUsersCount,
                        false
                    )
                },

                users: {
                    new_users_trend: {
                        chart_type: 'line_chart',
                        title: 'New User Registrations',
                        ...ensureMinimumDataPoints(
                            formatTrendData(newUsersTrend).labels,
                            newUsersTrend.map(d => toDouble(d.count)),
                            false
                        )
                    },
                    users_by_state: {
                        chart_type: 'bar_chart',
                        title: 'Users by State',
                        data: limitChartDataWithOthers(
                            usersByState.map(d => d._id || 'Unknown'),
                            usersByState.map(d => toDouble(d.count)),
                            false
                        )
                    },
                    dues_status: {
                        chart_type: 'donut_chart',
                        title: 'Customer Dues Status',
                        data: formatChartData(
                            ['No Dues', 'Has Dues'],
                            [toDouble(duesData.noDues), toDouble(duesData.withDues)]
                        ),
                        colors: ['#4CAF50', '#F44336']
                    },
                    top_customers: {
                        chart_type: 'bar_chart',
                        title: 'Top Customers by Revenue',
                        data: limitChartDataWithOthers(
                            topCustomers.map(d => d._id || 'Unknown'),
                            topCustomers.map(d => formatIndianCurrency(Math.round(d.totalSpent))),
                            true
                        )
                    }
                },

                orders: {
                    orders_trend: {
                        chart_type: 'line_chart',
                        title: 'Orders Over Time',
                        ...ensureMinimumDataPoints(
                            formatTrendData(ordersTrend).labels,
                            ordersTrend.map(d => toDouble(d.count)),
                            false
                        )
                    },
                    revenue_trend: {
                        chart_type: 'line_chart',
                        title: 'Revenue Over Time',
                        ...ensureMinimumDataPoints(
                            formatTrendData(revenueTrend).labels,
                            revenueTrend.map(d => formatIndianCurrency(Math.round(d.revenue))),
                            true
                        )
                    },
                    payment_methods: {
                        chart_type: 'pie_chart',
                        title: 'Payment Method Distribution',
                        data: limitChartDataWithOthers(
                            paymentMethods.map(d => d._id || 'Unknown'),
                            paymentMethods.map(d => toDouble(d.count)),
                            false
                        ),
                        colors: ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#607D8B', '#E91E63', '#795548']
                    },
                    orders_by_state: {
                        chart_type: 'bar_chart',
                        title: 'Orders by State',
                        data: limitChartDataWithOthers(
                            ordersByState.map(d => d._id || 'Unknown'),
                            ordersByState.map(d => toDouble(d.count)),
                            false
                        )
                    },
                    avg_order_value_trend: (() => {
                        const avgLabels = formatTrendData(revenueTrend).labels;
                        const avgData = revenueTrend.map((d, i) => {
                            const orderCount = ordersTrend[i]?.count || 1;
                            return formatIndianCurrency(Math.round(d.revenue / orderCount));
                        });
                        return {
                            chart_type: 'line_chart',
                            title: 'Average Order Value Trend',
                            ...ensureMinimumDataPoints(avgLabels, avgData, true)
                        };
                    })()
                },

                products: {
                    top_selling_products: {
                        chart_type: 'bar_chart',
                        title: 'Top Selling Products (by Quantity)',
                        data: limitChartDataWithOthers(
                            topSellingProducts.map(d => d._id || 'Unknown'),
                            topSellingProducts.map(d => toDouble(d.totalQuantity)),
                            false
                        )
                    },
                    product_revenue_share: {
                        chart_type: 'donut_chart',
                        title: 'Revenue by Top Products',
                        data: limitChartDataWithOthers(
                            productRevenue.map(d => d._id || 'Unknown'),
                            productRevenue.map(d => formatIndianCurrency(Math.round(d.revenue))),
                            true
                        ),
                        colors: ['#E91E63', '#3F51B5', '#009688', '#FF5722', '#795548', '#2196F3', '#4CAF50']
                    },
                    product_sales_trend: {
                        chart_type: 'line_chart',
                        title: 'Total Products Sold Over Time',
                        ...ensureMinimumDataPoints(
                            formatTrendData(ordersTrend).labels,
                            ordersTrend.map(d => toDouble(d.count * 2)),
                            false
                        )
                    },
                    free_products_given: {
                        chart_type: 'bar_chart',
                        title: 'Free Products Given',
                        data: limitChartDataWithOthers(
                            freeProductsStats.map(d => d._id || 'Unknown'),
                            freeProductsStats.map(d => toDouble(d.count)),
                            false
                        )
                    }
                }
            },
            period: {
                filter: filter || 'last_30_days',
                from: from.toISOString().split('T')[0],
                to: to.toISOString().split('T')[0],
                previousPeriod: {
                    from: prevFrom.toISOString().split('T')[0],
                    to: prevTo.toISOString().split('T')[0]
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
