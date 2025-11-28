use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuCapabilities {
    pub has_nvenc: bool,        // NVIDIA
    pub has_qsv: bool,          // Intel QuickSync
    pub has_vaapi: bool,        // Linux Generic / AMD / Intel
    pub has_videotoolbox: bool, // macOS
    pub has_amf: bool,          // AMD Windows
}

pub fn check_gpu_availability() -> GpuCapabilities {
    let output = Command::new("ffmpeg")
        .args(&["-hide_banner", "-encoders"])
        .output();

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();

            GpuCapabilities {
                has_nvenc: stdout.contains("nvenc"),
                has_qsv: stdout.contains("qsv"),
                has_vaapi: stdout.contains("vaapi"),
                has_videotoolbox: stdout.contains("videotoolbox"),
                has_amf: stdout.contains("amf"),
            }
        }
        Err(_) => {
            // Fallback if ffmpeg command fails
            GpuCapabilities {
                has_nvenc: false,
                has_qsv: false,
                has_vaapi: false,
                has_videotoolbox: false,
                has_amf: false,
            }
        }
    }
}
