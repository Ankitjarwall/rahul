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

// Helper to calculate percentage change
const calculatePercentageChange = (current, previous) => {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10; // Round to 1 decimal
};

// Helper to format trend info
const formatTrend = (current, previous) => {
    const percentage = calculatePercentageChange(current, previous);
    const isUp = percentage >= 0;
    return {
        value: current,
        previousValue: previous,
        percentage: percentage,
        trend: isUp ? 'up' : 'down',
        trendLabel: isUp ? `+${percentage}%` : `${percentage}%`,
        trendColor: isUp ? TREND_COLORS.up : TREND_COLORS.down
    };
};

// Helper for metrics without trend (all-time or cumulative)
const formatNoTrend = (value) => {
    return {
        value: value,
        previousValue: null,
        percentage: null,
        trend: '--',
        trendLabel: '--',
        trendColor: TREND_COLORS.neutral
    };
};

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        const { from, to } = getDateRange(filter, startDate, endDate);
        const { prevFrom, prevTo } = getPreviousPeriod(from, to);

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
                { $limit: 10 }
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
                { $limit: 5 }
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
                { $limit: 10 }
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
                { $limit: 5 }
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
                { $limit: 5 }
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
                { $limit: 5 }
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
                    totalUsers: formatNoTrend(totalUsers),
                    totalProducts: formatNoTrend(totalProducts),
                    totalOrders: formatTrend(
                        currentStats.totalOrders,
                        prevStats.totalOrders
                    ),
                    totalRevenue: formatTrend(
                        Math.round(currentStats.totalRevenue || 0),
                        Math.round(prevStats.totalRevenue || 0)
                    ),
                    totalDues: formatNoTrend(Math.round(currentDues.totalDues || 0)),
                    avgOrderValue: formatTrend(
                        Math.round(currentStats.avgOrderValue || 0),
                        Math.round(prevStats.avgOrderValue || 0)
                    ),
                    newUsers: formatTrend(
                        newUsersCount,
                        prevNewUsersCount
                    )
                },

                users: {
                    new_users_trend: {
                        chart_type: 'line_chart',
                        title: 'New User Registrations',
                        labels: formatTrendData(newUsersTrend).labels,
                        data: newUsersTrend.map(d => d.count)
                    },
                    users_by_state: {
                        chart_type: 'bar_chart',
                        title: 'Users by State',
                        labels: usersByState.map(d => d._id || 'Unknown'),
                        data: usersByState.map(d => d.count)
                    },
                    dues_status: {
                        chart_type: 'donut_chart',
                        title: 'Customer Dues Status',
                        labels: ['No Dues', 'Has Dues'],
                        data: [duesData.noDues, duesData.withDues],
                        colors: ['#4CAF50', '#F44336']
                    },
                    top_customers: {
                        chart_type: 'bar_chart',
                        title: 'Top 5 Customers by Revenue',
                        labels: topCustomers.map(d => d._id || 'Unknown'),
                        data: topCustomers.map(d => Math.round(d.totalSpent))
                    }
                },

                orders: {
                    orders_trend: {
                        chart_type: 'line_chart',
                        title: 'Orders Over Time',
                        labels: formatTrendData(ordersTrend).labels,
                        data: ordersTrend.map(d => d.count)
                    },
                    revenue_trend: {
                        chart_type: 'line_chart',
                        title: 'Revenue Over Time',
                        labels: formatTrendData(revenueTrend).labels,
                        data: revenueTrend.map(d => Math.round(d.revenue))
                    },
                    payment_methods: {
                        chart_type: 'pie_chart',
                        title: 'Payment Method Distribution',
                        labels: paymentMethods.map(d => d._id || 'Unknown'),
                        data: paymentMethods.map(d => d.count),
                        colors: ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#607D8B']
                    },
                    orders_by_state: {
                        chart_type: 'bar_chart',
                        title: 'Orders by State',
                        labels: ordersByState.map(d => d._id || 'Unknown'),
                        data: ordersByState.map(d => d.count)
                    },
                    avg_order_value_trend: {
                        chart_type: 'line_chart',
                        title: 'Average Order Value Trend',
                        labels: formatTrendData(revenueTrend).labels,
                        data: revenueTrend.map((d, i) => {
                            const orderCount = ordersTrend[i]?.count || 1;
                            return Math.round(d.revenue / orderCount);
                        })
                    }
                },

                products: {
                    top_selling_products: {
                        chart_type: 'bar_chart',
                        title: 'Top 5 Selling Products (by Quantity)',
                        labels: topSellingProducts.map(d => d._id || 'Unknown'),
                        data: topSellingProducts.map(d => d.totalQuantity)
                    },
                    product_revenue_share: {
                        chart_type: 'donut_chart',
                        title: 'Revenue by Top Products',
                        labels: productRevenue.map(d => d._id || 'Unknown'),
                        data: productRevenue.map(d => Math.round(d.revenue)),
                        colors: ['#E91E63', '#3F51B5', '#009688', '#FF5722', '#795548']
                    },
                    product_sales_trend: {
                        chart_type: 'line_chart',
                        title: 'Total Products Sold Over Time',
                        labels: formatTrendData(ordersTrend).labels,
                        data: ordersTrend.map(d => d.count * 2)
                    },
                    free_products_given: {
                        chart_type: 'bar_chart',
                        title: 'Free Products Given (Top 5)',
                        labels: freeProductsStats.map(d => d._id || 'Unknown'),
                        data: freeProductsStats.map(d => d.count)
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
