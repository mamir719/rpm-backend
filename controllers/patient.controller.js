const db = require("../config/db.js");
const {
  getPatientBPReadingsService,
  getPatientLatestBPService,
} = require("../services/patient.service");

// Import the same services used by the doctor controller — but we skip the
// doctor-patient access check because the verifyPatientOwnership middleware
// already ensures the patient can only fetch their own data.
const {
  getPatientVitalSignsService,
  getPatientDeviceDataService,
} = require("../services/doctor.service.js");

const getPatientBPReadingsController = async (req, res) => {
  try {
    const patient = req.user; // logged-in patient
    console.log("🟡 getPatientBPReadingsController - User ID:", patient.id);
    const readings = await getPatientBPReadingsService(patient.id);
    console.log("🟢 getPatientBPReadingsController - Readings found:", readings?.length);

    res.status(200).json({
      success: true,
      data: readings,
      message: "Blood pressure readings fetched successfully",
    });
  } catch (err) {
    console.error("❌ Error fetching BP readings:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};


 const getPatientLatestBPController = async (req, res) => {
   try {
     const patient = req.user;
     const latestReading = await getPatientLatestBPService(patient.id);

     res.status(200).json({
       success: true,
       data: latestReading,
       message: "Latest blood pressure reading fetched successfully",
     });
   } catch (err) {
     console.error("❌ Error fetching latest BP reading:", err);
     res.status(500).json({
       success: false,
       message: err.message || "Internal Server Error",
     });
   }
 };

// Patient viewing their own vital signs (no doctor-access check needed)
const getPatientOwnVitalSignsController = async (req, res) => {
  try {
    const { patientId } = req.params;
    // verifyPatientOwnership middleware already confirmed req.user.id == patientId
    const vitalSigns = await getPatientVitalSignsService(patientId);
    res.status(200).json({ success: true, data: vitalSigns });
  } catch (err) {
    console.error("❌ Error fetching patient vital signs:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

// Patient viewing their own device data (no doctor-access check needed)
const getPatientOwnDeviceDataController = async (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      deviceType = "bp",
      days = 30,
      page = 1,
      limit = 10,
      fromDate,
      toDate,
    } = req.query;

    const daysInt = parseInt(days);
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    if (!["bp", "spo2"].includes(deviceType)) {
      return res.status(400).json({
        success: false,
        message: "Device type must be 'bp' or 'spo2'",
      });
    }

    const deviceData = await getPatientDeviceDataService(
      patientId,
      deviceType,
      isNaN(daysInt) ? 30 : daysInt,
      isNaN(pageInt) || pageInt < 1 ? 1 : pageInt,
      isNaN(limitInt) || limitInt < 1 || limitInt > 100 ? 10 : limitInt,
      fromDate,
      toDate
    );

    res.status(200).json({ success: true, data: deviceData });
  } catch (err) {
    console.error("❌ Error fetching patient device data:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const getPatientDoctorAlertSettingsController = async (req, res) => {
  try {
    const patient_id = req.user.id;

    // Find the doctor assigned to this patient
    const [assignments] = await db.query(
      "SELECT doctor_id FROM patient_doctor_assignments WHERE patient_id = ? LIMIT 1",
      [patient_id]
    );

    if (assignments.length === 0) {
      // Return default settings if no doctor is assigned
      return res.json({
        success: true,
        settings: {
          systolic_high: 140,
          systolic_low: 90,
          diastolic_high: 90,
          diastolic_low: 60,
        },
        isDefault: true,
      });
    }

    const doctor_id = assignments[0].doctor_id;

    // Get doctor's settings
    const [settingsRows] = await db.query(
      "SELECT * FROM doctor_alert_settings WHERE doctor_id = ?",
      [doctor_id]
    );

    if (!settingsRows || settingsRows.length === 0) {
      return res.json({
        success: true,
        settings: {
          systolic_high: 140,
          systolic_low: 90,
          diastolic_high: 90,
          diastolic_low: 60,
        },
        isDefault: true,
      });
    }

    res.json({
      success: true,
      settings: settingsRows[0],
      isDefault: false,
    });
  } catch (error) {
    console.error("Error fetching doctor alert settings for patient:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getPatientBPReadingsController,
  getPatientLatestBPController,
  getPatientOwnVitalSignsController,
  getPatientOwnDeviceDataController,
  getPatientDoctorAlertSettingsController,
};
