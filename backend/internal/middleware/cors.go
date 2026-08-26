package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func SetupCORS(app *fiber.App, frontendURL string) {
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Requested-With",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
		AllowOriginsFunc: func(origin string) bool {
			return true
		},
	}))
}