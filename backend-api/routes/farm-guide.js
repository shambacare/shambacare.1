const express = require('express'); 
const router = express.Router(); 
const { Farm, Crop, Task, CropActivity } = require('../models'); 
const { verifyToken } = require('../middleware/auth'); 
 
// Crop growth stages database 
const cropGrowthStages = { 
    'Maize': { 
        duration_days: 120, 
        stages: [ 
            { name: 'Land Preparation', days: 0, activities: ['Clear land', 'Plough', 'Harrow', 'Add manure/fertilizer'] }, 
            { name: 'Planting', days: 1, activities: ['Plant seeds 2-3cm deep', 'Space 25cm apart', 'Water thoroughly'] }, 
            { name: 'Germination', days: 7, activities: ['Monitor emergence', 'Ensure soil moisture', 'Protect from birds'] }, 
            { name: 'Early Growth', days: 21, activities: ['First weeding', 'Apply starter fertilizer', 'Thin to one plant per hole'] }, 
            { name: 'Vegetative Growth', days: 35, activities: ['Second weeding', 'Top dress with CAN fertilizer', 'Monitor for pests'] }, 
            { name: 'Tasseling', days: 60, activities: ['Ensure adequate water', 'Monitor for armyworms', 'Apply fungicide if needed'] }, 
            { name: 'Silking', days: 70, activities: ['Irrigation critical', 'Watch for earworms', 'Apply calcium if needed'] }, 
            { name: 'Grain Fill', days: 85, activities: ['Reduce watering', 'Monitor for diseases', 'Support tall plants'] }, 
            { name: 'Maturation', days: 105, activities: ['Stop watering', 'Watch for birds', 'Prepare for harvest'] }, 
            { name: 'Harvest', days: 120, activities: ['Harvest when grains hard', 'Dry thoroughly', 'Store in cool dry place'] } 
        ] 
    }, 
    'Coffee': { 
        duration_days: 365, 
        stages: [ 
            { name: 'Land Preparation', days: 0, activities: ['Clear land', 'Test soil pH (6-6.5)', 'Dig planting holes'] }, 
            { name: 'Planting', days: 1, activities: ['Plant seedlings', 'Apply mulch', 'Provide shade'] }, 
            { name: 'Establishment', days: 90, activities: ['Regular watering', 'Weed control', 'Fertilize every 3 months'] }, 
            { name: 'Vegetative Growth', days: 180, activities: ['Prune shaping', 'Monitor for rust', 'Apply nitrogen fertilizer'] }, 
            { name: 'Flowering', days: 270, activities: ['Ensure water availability', 'Apply potassium', 'Monitor for pests'] }, 
            { name: 'Berry Development', days: 320, activities: ['Regular irrigation', 'Apply phosphorus', 'Watch for coffee berry borer'] }, 
            { name: 'Ripening', days: 350, activities: ['Reduce water', 'Monitor color change', 'Prepare for harvest'] }, 
            { name: 'Harvest', days: 365, activities: ['Pick ripe cherries', 'Process within 24hrs', 'Dry properly'] } 
        ] 
    }, 
    'Tomato': { 
        duration_days: 90, 
        stages: [ 
            { name: 'Seed Starting', days: 0, activities: ['Start seeds in nursery', 'Keep moist', 'Provide light'] }, 
            { name: 'Transplanting', days: 30, activities: ['Transplant to main field', 'Space 45cm apart', 'Water deeply'] }, 
            { name: 'Early Growth', days: 45, activities: ['Stake plants', 'First weeding', 'Apply nitrogen fertilizer'] }, 
            { name: 'Flowering', days: 55, activities: ['Reduce nitrogen', 'Increase phosphorus', 'Pollinate by shaking'] }, 
            { name: 'Fruit Set', days: 65, activities: ['Apply calcium', 'Consistent watering', 'Remove suckers'] }, 
            { name: 'Fruit Development', days: 75, activities: ['Support heavy branches', 'Monitor for blight', 'Apply fungicide'] }, 
            { name: 'Ripening', days: 85, activities: ['Reduce water', 'Harvest as they ripen', 'Watch for cracking'] }, 
            { name: 'Harvest', days: 90, activities: ['Harvest at peak color', 'Store in cool place', 'Remove diseased plants'] } 
        ] 
    }, 
    'Potato': { 
        duration_days: 100, 
        stages: [ 
            { name: 'Seed Preparation', days: 0, activities: ['Select certified seeds', 'Chit/sprout seeds', 'Cut into pieces with eyes'] }, 
            { name: 'Planting', days: 1, activities: ['Plant 10cm deep', 'Space 30cm apart', 'Apply starter fertilizer'] }, 
            { name: 'Sprouting', days: 14, activities: ['Monitor emergence', 'Keep soil moist', 'Protect from frost'] }, 
            { name: 'Vegetative Growth', days: 35, activities: ['First hilling', 'Apply nitrogen', 'Control weeds'] }, 
            { name: 'Tuber Initiation', days: 50, activities: ['Second hilling', 'Apply potassium', 'Monitor for blight'] }, 
            { name: 'Tuber Bulking', days: 70, activities: ['Consistent watering', 'Apply phosphorus', 'Watch for pests'] }, 
            { name: 'Maturation', days: 90, activities: ['Stop watering', 'Let vines die back', 'Prepare for harvest'] }, 
            { name: 'Harvest', days: 100, activities: ['Harvest when skins set', 'Cure for 2 weeks', 'Store in dark cool place'] } 
        ] 
    }, 
    'Beans': { 
        duration_days: 70, 
        stages: [ 
            { name: 'Land Prep', days: 0, activities: ['Clear land', 'Add compost', 'Form rows'] }, 
            { name: 'Planting', days: 1, activities: ['Plant seeds 5cm deep', 'Space 10cm apart', 'Water gently'] }, 
            { name: 'Germination', days: 7, activities: ['Monitor emergence', 'Keep soil moist', 'Protect from birds'] }, 
            { name: 'Vegetative Growth', days: 21, activities: ['First weeding', 'Apply nitrogen', 'Support climbing varieties'] }, 
            { name: 'Flowering', days: 35, activities: ['Reduce nitrogen', 'Ensure pollinators', 'Monitor for aphids'] }, 
            { name: 'Pod Formation', days: 49, activities: ['Consistent moisture', 'Apply potassium', 'Watch for rust'] }, 
            { name: 'Pod Fill', days: 60, activities: ['Reduce water', 'Monitor for maturity', 'Support heavy pods'] }, 
            { name: 'Harvest', days: 70, activities: ['Harvest when pods dry', 'Thresh', 'Store in airtight container'] } 
        ] 
    } 
}; 
 
function getTaskType(stageName) { 
    if (stageName.includes('Planting')) return 'planting'; 
    if (stageName.includes('Harvest')) return 'harvesting'; 
    if (stageName.includes('Weed')) return 'weeding'; 
    if (stageName.includes('Monitor')) return 'monitoring'; 
    return 'other'; 
} 
 
router.get('/crop-stages/:cropName', verifyToken, async (req, res) =
    const cropName = req.params.cropName; 
    res.json({ success: true, stages: growthData.stages, duration_days: growthData.duration_days }); 
}); 
 
router.post('/generate-tasks', verifyToken, async (req, res) =
    const { farm_id, crop_name, planting_date } = req.body; 
    const planting = new Date(planting_date); 
    const tasks = []; 
        const stage = growthData.stages[i]; 
        const scheduled_date = new Date(planting); 
        scheduled_date.setDate(planting.getDate() + stage.days); 
        tasks.push({ 
            farm_id, crop_name, task_name: stage.name, 
            description: stage.activities.join('. '), 
            task_type: getTaskType(stage.name), scheduled_date, 
            position_order: i, 
            days_after_previous: i === 0 ? 0 : growthData.stages[i].days - growthData.stages[i-1].days, 
            completed: false 
        }); 
    } 
    const created = await Task.bulkCreate(tasks); 
    res.json({ success: true, tasks: created }); 
}); 
 
router.get('/pending-tasks/:farm_id', verifyToken, async (req, res) =
    const tasks = await Task.findAll({ 
        where: { farm_id: req.params.farm_id, completed: false }, 
        order: [['scheduled_date', 'ASC']] 
    }); 
    res.json({ success: true, tasks }); 
}); 
 
router.get('/tasks/:farm_id', verifyToken, async (req, res) =
    const tasks = await Task.findAll({ 
        where: { farm_id: req.params.farm_id }, 
        order: [['position_order', 'ASC']] 
    }); 
    res.json({ success: true, tasks }); 
}); 
 
router.put('/tasks/:task_id/complete', verifyToken, async (req, res) =
    const task = await Task.findByPk(req.params.task_id); 
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' }); 
    task.completed = true; 
    task.completed_date = new Date(); 
    await task.save(); 
    await CropActivity.create({ 
        crop_id: task.farm_id, activity_type: task.task_type, 
        activity_date: new Date(), notes: `Completed: ${task.task_name} - ${task.description}`, 
        health_status: 'good' 
    }); 
    res.json({ success: true, task }); 
}); 
 
router.post('/tasks', verifyToken, async (req, res) =
    const { farm_id, crop_name, task_name, description, scheduled_date } = req.body; 
    const task = await Task.create({ 
        farm_id, crop_name, task_name, description, 
        scheduled_date, completed: false, task_type: 'other' 
    }); 
    res.json({ success: true, task }); 
}); 
 
router.post('/crop-health', verifyToken, async (req, res) =
    const { crop_id, health_status, notes, images } = req.body; 
    const activity = await CropActivity.create({ 
        crop_id, activity_type: 'health_check', activity_date: new Date(), 
        notes, images, health_status 
    }); 
    let healthScore = health_status === 'excellent' ? 90 : health_status === 'good' ? 75 : health_status === 'fair' ? 60 : health_status === 'poor' ? 40 : 25; 
    await Farm.update({ health_score: healthScore, last_assessment: new Date() }, { where: { id: crop_id } }); 
    res.json({ success: true, activity }); 
}); 
 
router.get('/crop-health/:crop_id', verifyToken, async (req, res) =
    const activities = await CropActivity.findAll({ 
        where: { crop_id: req.params.crop_id, activity_type: 'health_check' }, 
        order: [['activity_date', 'DESC']] 
    }); 
    res.json({ success: true, activities }); 
}); 
 
router.get('/weather-recommendations', verifyToken, async (req, res) =
    const { weather_condition } = req.query; 
    const recommendations = { 
        'rainy': { 
            actions: ['Avoid spraying today', 'Check for waterlogging', 'Apply nitrogen after rain'], 
            warnings: ['Risk of fungal diseases', 'Delay harvesting if rain continues'], 
            tasks: ['Inspect drainage systems', 'Monitor for early blight'] 
        }, 
        'sunny': { 
            actions: ['Ideal for spraying', 'Water crops in evening', 'Apply fertilizer'], 
            warnings: ['Watch for heat stress', 'Mulch to retain moisture'], 
            tasks: ['Check soil moisture', 'Inspect for sunburn on fruits'] 
        }, 
        'cloudy': { 
            actions: ['Good for transplanting', 'Apply foliar feeds', 'Monitor humidity levels'], 
            warnings: ['Possible pest activity', 'Check for powdery mildew'], 
            tasks: ['Inspect for aphids', 'Check ventilation'] 
        }, 
        'hot': { 
            actions: ['Water early morning/evening', 'Provide shade if possible', 'Avoid fertilizing'], 
            warnings: ['High evaporation risk', 'Heat stress possible'], 
            tasks: ['Mulch heavily', 'Check for wilting', 'Increase irrigation frequency'] 
        }, 
        'cold': { 
            actions: ['Delay planting', 'Cover sensitive crops', 'Avoid watering'], 
            warnings: ['Frost risk', 'Slow growth expected'], 
            tasks: ['Check for frost damage', 'Apply extra mulch'] 
        } 
    }; 
    res.json({ success: true, recommendations: rec }); 
}); 
 
module.exports = router; 
