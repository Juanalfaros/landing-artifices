<?php
/**
 * Backend Seguro para Formulario de Leads de Artífices Studio
 * * - Valida reCAPTCHA v3 y Honeypot para seguridad.
 * - Añade el contacto a una lista de Brevo.
 * - Crea una tarea en una lista de ClickUp.
 * * INSTRUCCIONES:
 * 1. Rellena las 5 constantes en la sección de CONFIGURACIÓN.
 * 2. Sube este archivo a tu hosting (ej. /api/submit-lead.php).
 * 3. Asegúrate de que el 'endpoint' en tu JavaScript apunte a este archivo.
 */

// Descomenta las siguientes dos líneas SOLO si necesitas depurar errores.
// ¡NUNCA las dejes activas en un sitio en producción!
// ini_set('display_errors', 1);
// error_reporting(E_ALL);

// --- CONFIGURACIÓN DE CLAVES SECRETAS Y IDs ---
// ¡MANTÉN ESTOS DATOS SIEMPRE EN EL SERVIDOR, NUNCA EN EL HTML/JS!

// 1. Google reCAPTCHA v3
define('RECAPTCHA_SECRET_KEY', 'TU_CLAVE_SECRETA_DE_RECAPTCHA_V3_AQUI');

// 2. Brevo (antes Sendinblue)
define('BREVO_API_KEY', 'TU_API_KEY_DE_BREVO_AQUI');
define('BREVO_LIST_ID', 123); // <-- Reemplaza 123 con el ID numérico de tu lista en Brevo

// 3. ClickUp
define('CLICKUP_API_KEY', 'TU_API_KEY_DE_CLICKUP_AQUI');
define('CLICKUP_LIST_ID', '987654'); // <-- Reemplaza 987654 con el ID de tu lista de tareas en ClickUp


// --- CÓDIGO DEL SCRIPT ---

// Establecer la cabecera de respuesta como JSON para comunicarnos con el JavaScript
header('Content-Type: application/json');

// Función para enviar respuestas estandarizadas y detener el script
function send_response($status, $message, $data = [])
{
    http_response_code($status);
    echo json_encode(['message' => $message, 'data' => $data]);
    exit;
}

// Solo permitir solicitudes de tipo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_response(405, 'Método no permitido.');
}

// Decodificar el JSON enviado desde el JavaScript
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    send_response(400, 'Solicitud mal formada.');
}

// 1. Validación de Seguridad: Honeypot
// Si el campo trampa 'comment' tiene contenido, es un bot.
if (!empty($input['comment'])) {
    // Engañamos al bot respondiendo con éxito, pero no hacemos nada más.
    send_response(200, 'Solicitud recibida.');
}

// 2. Validación de Seguridad: reCAPTCHA v3
$recaptcha_token = $input['recaptchaToken'] ?? '';
if (empty($recaptcha_token)) {
    send_response(400, 'Falta el token de seguridad.');
}

$recaptcha_url = 'https://www.google.com/recaptcha/api/siteverify';
$recaptcha_data = http_build_query([
    'secret' => RECAPTCHA_SECRET_KEY,
    'response' => $recaptcha_token,
    'remoteip' => $_SERVER['REMOTE_ADDR']
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $recaptcha_url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $recaptcha_data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$recaptcha_result = curl_exec($ch);
curl_close($ch);
$recaptcha_response = json_decode($recaptcha_result);

// Si Google dice que no es válido o la puntuación es baja, bloqueamos la solicitud.
if (!$recaptcha_response || !$recaptcha_response->success || $recaptcha_response->score < 0.5) {
    send_response(403, 'Falló la verificación de seguridad. Inténtalo de nuevo.');
}

// Si las validaciones pasan, procedemos a las integraciones.

// 3. Integración con Brevo
$brevo_payload = json_encode([
    'email' => $input['email'],
    'attributes' => [
        'NOMBRE' => $input['name'],
        'EMPRESA' => $input['company'],
        'SITIO_WEB' => $input['website']
    ],
    'listIds' => [BREVO_LIST_ID],
    'updateEnabled' => true
]);

$ch_brevo = curl_init('https://api.brevo.com/v3/contacts');
curl_setopt($ch_brevo, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_brevo, CURLOPT_POST, true);
curl_setopt($ch_brevo, CURLOPT_POSTFIELDS, $brevo_payload);
curl_setopt($ch_brevo, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json',
    'api-key: ' . BREVO_API_KEY
]);
$brevo_result = curl_exec($ch_brevo);
$brevo_http_code = curl_getinfo($ch_brevo, CURLINFO_HTTP_CODE);
curl_close($ch_brevo);

if ($brevo_http_code < 200 || $brevo_http_code >= 300) {
    error_log("Error de Brevo: " . $brevo_result);
    // Podríamos detenernos aquí, pero intentaremos seguir con ClickUp.
}


// 4. Integración con ClickUp
$task_name = "Nuevo Lead: " . ($input['company'] ?: $input['name']);
$task_description = "Se ha recibido un nuevo lead desde la landing page.\n\n" .
    "Nombre: " . $input['name'] . "\n" .
    "Email: " . $input['email'] . "\n" .
    "Empresa: " . $input['company'] . "\n" .
    "Sitio Web: " . $input['website'];

$clickup_payload = json_encode([
    'name' => $task_name,
    'description' => $task_description,
    'status' => 'To Do', // O el estado que uses para nuevos leads
    'priority' => 3, // 1: Urgente, 2: Alta, 3: Normal, 4: Baja
    'notify_all' => true
]);

$ch_clickup = curl_init('https://api.clickup.com/api/v2/list/' . CLICKUP_LIST_ID . '/task');
curl_setopt($ch_clickup, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_clickup, CURLOPT_POST, true);
curl_setopt($ch_clickup, CURLOPT_POSTFIELDS, $clickup_payload);
curl_setopt($ch_clickup, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: ' . CLICKUP_API_KEY
]);
$clickup_result = curl_exec($ch_clickup);
$clickup_http_code = curl_getinfo($ch_clickup, CURLINFO_HTTP_CODE);
curl_close($ch_clickup);

if ($clickup_http_code < 200 || $clickup_http_code >= 300) {
    error_log("Error de ClickUp: " . $clickup_result);
}

// 5. Respuesta Final
// Enviamos una respuesta de éxito incluso si una de las integraciones falla,
// para no confundir al usuario. Los errores se registran en el servidor.
send_response(200, 'Solicitud procesada con éxito.');

?>