export function getEventInvitationEmailHtml({
  eventTitle,
  organizerName,
  proposedDates,
  inviteLink,
}: {
  eventTitle: string
  organizerName: string
  proposedDates: string[]
  inviteLink: string
}) {
  const datesHtml = proposedDates
    .map(date => `<li style="padding: 4px 0;">${date}</li>`)
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎲 GameNight</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 22px;">¡Te han invitado a una quedada!</h2>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        <strong>${organizerName}</strong> te ha invitado a participar en una quedada de juegos de mesa:
      </p>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 18px;">${eventTitle}</h3>
        <p style="color: #78350f; margin: 0; font-size: 14px;">Fechas propuestas:</p>
        <ul style="color: #78350f; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px;">
          ${datesHtml}
        </ul>
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Confirma tu disponibilidad y vota por los juegos que te gustaría jugar.
      </p>
      
      <div style="text-align: center;">
        <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Ver invitación
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Has recibido este email porque te invitaron a una quedada en GameNight.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #d97706; text-decoration: none;">gamenight.app</a>
      </p>
    </div>
  </div>
</body>
</html>
`
}

export function getEventConfirmedEmailHtml({
  eventTitle,
  finalDate,
  finalTime,
  location,
  games,
  eventLink,
}: {
  eventTitle: string
  finalDate: string
  finalTime?: string
  location?: string
  games: { name: string; responsible: string }[]
  eventLink: string
}) {
  const gamesHtml = games
    .map(g => `<li style="padding: 4px 0;"><strong>${g.name}</strong> - lleva: ${g.responsible}</li>`)
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✅ ¡Quedada confirmada!</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 24px 0; font-size: 22px;">${eventTitle}</h2>
      
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #065f46; margin: 0 0 8px 0; font-size: 16px;">
          📅 <strong>${finalDate}</strong>${finalTime ? ` a las ${finalTime}` : ''}
        </p>
        ${location ? `<p style="color: #065f46; margin: 0; font-size: 16px;">📍 ${location}</p>` : ''}
      </div>
      
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 16px;">Juegos a jugar:</h3>
      <ul style="color: #4b5563; margin: 0 0 24px 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
        ${gamesHtml}
      </ul>
      
      <div style="text-align: center;">
        <a href="${eventLink}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Ver detalles
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        ¡Nos vemos pronto! 🎲
      </p>
    </div>
  </div>
</body>
</html>
`
}
