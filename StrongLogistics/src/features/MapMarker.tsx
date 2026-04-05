import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { DeliveryPoint, Priority } from '../types';
import { getPriorityColor } from '../utils/priorityColors';

interface Props {
  point: DeliveryPoint;
  priority?: Priority;
  onClick?: () => void;
}

export default function MapMarker({ point, priority = 'normal', onClick }: Props) {
  const color = getPriorityColor(priority);
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <Marker
      position={[point.latitude, point.longitude]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    />
  );
}
