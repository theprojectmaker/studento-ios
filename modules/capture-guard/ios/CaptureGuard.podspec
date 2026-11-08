Pod::Spec.new do |s|
  s.name           = 'CaptureGuard'
  s.version        = '1.0.0'
  s.summary        = 'Tells Studento when the screen is being recorded, mirrored or shared'
  s.description    = 'Wraps UIScreen.isCaptured and its change notification.'
  s.license        = 'MIT'
  s.author         = 'Studento'
  s.homepage       = 'https://studento-app.pages.dev'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,swift}"
end
