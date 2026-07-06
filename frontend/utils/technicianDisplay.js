/**
 * Human-readable label for technician selects (never raw UUID when avoidable).
 */
export function formatTechnicianLabel(tech) {
  if (!tech) return 'Unknown';

  if (tech.user?.first_name || tech.user?.last_name) {
    const name = [tech.user.first_name, tech.user.last_name].filter(Boolean).join(' ').trim();
    if (name) {
      return tech.employee_id ? `${name} (${tech.employee_id})` : name;
    }
  }

  if (tech.first_name || tech.last_name) {
    const name = [tech.first_name, tech.last_name].filter(Boolean).join(' ').trim();
    if (name) {
      return tech.employee_id ? `${name} (${tech.employee_id})` : name;
    }
  }

  if (tech.name && tech.name !== 'Unknown') {
    return tech.employee_id ? `${tech.name} (${tech.employee_id})` : tech.name;
  }

  if (tech.employee_id) {
    return tech.employee_id;
  }

  if (tech.user?.email) {
    return tech.user.email;
  }

  if (tech.email) {
    return tech.email;
  }

  return 'Unknown technician';
}
