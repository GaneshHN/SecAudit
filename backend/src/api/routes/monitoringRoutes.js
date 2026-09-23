const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');

// All read-only endpoints for the observability subsystem
router.get('/metrics', (req, res) => monitoringController.getMetrics(req, res));
router.get('/health', (req, res) => monitoringController.getHealth(req, res));
router.get('/queue', (req, res) => monitoringController.getQueueStats(req, res));
router.get('/workers', (req, res) => monitoringController.getWorkers(req, res));
router.get('/system', (req, res) => monitoringController.getSystem(req, res));

module.exports = router;
