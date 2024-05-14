namespace Vv1.DashSync;

public class WeatherRecord
{
    public double BarometricPressure { get; set; }
    public string? SunPhase { get; set; }
    public double Temperature { get; set; }
    public string? WeatherLabel { get; set; }
    public string? ObservationTime { get; set; }
    public WindDirection? WindDirection { get; set; }
    public string? MoonPhase { get; set; }
}
