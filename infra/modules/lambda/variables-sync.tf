variable "alert_emails" {
  description = "E-mails que recebem alertas quando cliente muda de nível"
  type        = list(string)
  default     = []
}
