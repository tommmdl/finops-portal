output "app_id" {
  value = aws_amplify_app.main.id
}

output "app_url" {
  value = "https://main.${aws_amplify_app.main.id}.amplifyapp.com"
}
